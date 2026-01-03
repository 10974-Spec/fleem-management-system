const net = require('net');
const dgram = require('dgram');
const GPSDevice = require('../models/GPSDevice');
const GPSData = require('../models/GPSData');
const Vehicle = require('../models/Vehicle');
const gpsParsers = require('../utils/gpsParsers');
const alertEngine = require('../utils/alertEngine');
const redisService = require('./redisService');
const websocketService = require('./websocketService');

class GPSServer {
  constructor() {
    this.tcpServer = null;
    this.udpServer = null;
    this.connectedDevices = new Map();
    this.deviceBuffers = new Map();
  }

  initialize() {
    this.startTCPServer();
    this.startUDPServer();
    this.startHealthMonitor();
    console.log('GPS Server initialized');
  }

  startTCPServer() {
    this.tcpServer = net.createServer((socket) => {
      const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
      console.log(`TCP Client connected: ${clientId}`);

      socket.on('data', async (data) => {
        await this.handleGPSData(data, socket, 'TCP');
      });

      socket.on('error', (err) => {
        console.error(`TCP Socket error for ${clientId}:`, err.message);
        this.cleanupDevice(clientId);
      });

      socket.on('close', () => {
        console.log(`TCP Client disconnected: ${clientId}`);
        this.cleanupDevice(clientId);
      });
    });

    const tcpPort = process.env.GPS_TCP_PORT || 5000;
    this.tcpServer.listen(tcpPort, () => {
      console.log(`TCP GPS server listening on port ${tcpPort}`);
    });

    this.tcpServer.on('error', (err) => {
      console.error('TCP Server error:', err);
    });
  }

  startUDPServer() {
    this.udpServer = dgram.createSocket('udp4');

    this.udpServer.on('message', async (data, rinfo) => {
      const clientId = `${rinfo.address}:${rinfo.port}`;
      await this.handleGPSData(data, rinfo, 'UDP');
    });

    this.udpServer.on('error', (err) => {
      console.error('UDP Server error:', err);
    });

    this.udpServer.on('listening', () => {
      const address = this.udpServer.address();
      console.log(`UDP GPS server listening on ${address.address}:${address.port}`);
    });

    const udpPort = process.env.GPS_UDP_PORT || 5001;
    this.udpServer.bind(udpPort);
  }

  async handleGPSData(rawData, connectionInfo, protocol) {
    try {
      const dataString = rawData.toString().trim();
      
      if (!dataString || dataString.length < 10) {
        console.warn('Invalid data received:', dataString);
        return;
      }

      let imei = this.extractIMEI(dataString);
      if (!imei) {
        console.warn('Could not extract IMEI from data:', dataString.substring(0, 100));
        return;
      }

      const device = await this.getOrRegisterDevice(imei);
      if (!device) {
        console.warn(`Device with IMEI ${imei} not registered`);
        return;
      }

      const parsedData = await this.parseGPSData(dataString, device.brand);
      if (!parsedData) {
        return;
      }

      await this.processGPSData(device, parsedData, dataString);

      if (protocol === 'TCP' && connectionInfo && device.protocol === 'TCP') {
        await this.sendAcknowledgement(connectionInfo, device.brand);
      }

      console.log(`Processed GPS data for device ${imei}: ${parsedData.lat}, ${parsedData.lng}`);
    } catch (error) {
      console.error('Error handling GPS data:', error);
    }
  }

  extractIMEI(dataString) {
    const imeiPatterns = [
      /imei:(\d{15})/i,
      /(\d{15})/,
      /^##,imei:(\d{15}),/,
      /^\*[A-Z]{2},(\d{15}),/,
      /^([0-9A-F]{30})/,
      /(\d{15}),.*,.*,.*,.*,/ 
    ];

    for (const pattern of imeiPatterns) {
      const match = dataString.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  async getOrRegisterDevice(imei) {
    try {
      let device = await GPSDevice.findOne({ imei });
      
      if (!device) {
        console.log(`New device detected with IMEI: ${imei}`);
        device = new GPSDevice({
          imei,
          brand: 'Custom',
          status: 'Connected',
          lastSeen: new Date()
        });
        await device.save();
      }

      if (device.status !== 'Connected') {
        device.status = 'Connected';
        device.lastSeen = new Date();
        await device.save();
      }

      this.connectedDevices.set(imei, {
        device,
        lastUpdate: Date.now(),
        connectionCount: (this.connectedDevices.get(imei)?.connectionCount || 0) + 1
      });

      return device;
    } catch (error) {
      console.error('Error getting/registering device:', error);
      return null;
    }
  }

  async parseGPSData(dataString, brand) {
    try {
      const parsedData = gpsParsers.parseData(dataString, brand);
      
      if (!parsedData.lat || !parsedData.lng) {
        throw new Error('Invalid coordinates');
      }

      if (Math.abs(parsedData.lat) > 90 || Math.abs(parsedData.lng) > 180) {
        throw new Error('Coordinates out of range');
      }

      if (!parsedData.timestamp) {
        parsedData.timestamp = new Date();
      }

      if (parsedData.timestamp.getTime() > Date.now() + 5 * 60 * 1000) {
        parsedData.timestamp = new Date();
      }

      return parsedData;
    } catch (error) {
      console.error('Error parsing GPS data:', error.message);
      
      try {
        const fallbackData = this.parseFallbackData(dataString);
        if (fallbackData) {
          console.log('Used fallback parser');
          return fallbackData;
        }
      } catch (fallbackError) {
        console.error('Fallback parser also failed:', fallbackError.message);
      }
      
      return null;
    }
  }

  parseFallbackData(dataString) {
    const patterns = [
      {
        regex: /(\d{2})(\d{2})(\d{2}\.\d+),([NS]),(\d{3})(\d{2})(\d{2}\.\d+),([EW])/,
        parse: (match) => {
          const latDeg = parseInt(match[1]);
          const latMin = parseFloat(match[2] + '.' + match[3].split('.')[0]);
          const latSec = parseFloat('0.' + match[3].split('.')[1]) * 60;
          const latDir = match[4];
          
          const lonDeg = parseInt(match[5]);
          const lonMin = parseFloat(match[6] + '.' + match[7].split('.')[0]);
          const lonSec = parseFloat('0.' + match[7].split('.')[1]) * 60;
          const lonDir = match[8];
          
          const lat = latDeg + latMin/60 + latSec/3600;
          const lng = lonDeg + lonMin/60 + lonSec/3600;
          
          return {
            lat: latDir === 'S' ? -lat : lat,
            lng: lonDir === 'W' ? -lng : lng,
            timestamp: new Date(),
            speed: 0,
            heading: 0
          };
        }
      },
      {
        regex: /(-?\d+\.\d+),(-?\d+\.\d+)/,
        parse: (match) => ({
          lat: parseFloat(match[1]),
          lng: parseFloat(match[2]),
          timestamp: new Date(),
          speed: 0,
          heading: 0
        })
      }
    ];

    for (const pattern of patterns) {
      const match = dataString.match(pattern.regex);
      if (match) {
        return pattern.parse(match);
      }
    }

    throw new Error('No fallback pattern matched');
  }

  async processGPSData(device, parsedData, rawData) {
    try {
      const gpsData = new GPSData({
        deviceId: device._id,
        vehicleId: device.vehicleId,
        ...parsedData,
        rawData: rawData.substring(0, 1000)
      });

      await gpsData.save();

      device.lastSeen = new Date();
      await device.save();

      if (device.vehicleId) {
        await Vehicle.findByIdAndUpdate(device.vehicleId, {
          currentLocation: {
            lat: parsedData.lat,
            lng: parsedData.lng,
            lastUpdated: new Date()
          },
          odometer: parsedData.odometer || 0
        });

        await redisService.publish('vehicle_location', {
          vehicleId: device.vehicleId,
          tenantId: device.tenantId,
          location: {
            lat: parsedData.lat,
            lng: parsedData.lng,
            speed: parsedData.speed,
            heading: parsedData.heading,
            timestamp: parsedData.timestamp
          }
        });

        await websocketService.emitLocationUpdate(
          device.tenantId,
          device.vehicleId,
          {
            lat: parsedData.lat,
            lng: parsedData.lng,
            speed: parsedData.speed,
            heading: parsedData.heading,
            ignition: parsedData.ignition
          }
        );
      }

      await alertEngine.checkAlerts(gpsData, device);

      await redisService.publish('gps_data_processed', {
        deviceId: device._id,
        imei: device.imei,
        timestamp: new Date(),
        dataPoints: 1
      });

    } catch (error) {
      console.error('Error processing GPS data:', error);
      
      await redisService.publish('gps_processing_error', {
        deviceId: device._id,
        imei: device.imei,
        error: error.message,
        timestamp: new Date()
      });
    }
  }

  async sendAcknowledgement(connection, brand) {
    try {
      const acknowledgements = {
        Teltonika: '01',
        Concox: 'OK',
        Queclink: 'ACK',
        Meitrack: 'ACK',
        Custom: 'OK'
      };

      const ack = acknowledgements[brand] || 'OK';
      
      if (connection.write) {
        connection.write(ack + '\r\n');
      }
    } catch (error) {
      console.error('Error sending acknowledgement:', error);
    }
  }

  cleanupDevice(clientId) {
    const imei = this.findIMEIByClientId(clientId);
    if (imei) {
      this.connectedDevices.delete(imei);
      this.deviceBuffers.delete(imei);
    }
  }

  findIMEIByClientId(clientId) {
    for (const [imei, info] of this.connectedDevices) {
      if (info.clientId === clientId) {
        return imei;
      }
    }
    return null;
  }

  startHealthMonitor() {
    setInterval(() => {
      const now = Date.now();
      const threshold = 5 * 60 * 1000;

      for (const [imei, info] of this.connectedDevices) {
        if (now - info.lastUpdate > threshold) {
          console.log(`Device ${imei} hasn't sent data in 5 minutes`);
          
          GPSDevice.findOneAndUpdate(
            { imei },
            { 
              status: 'Offline',
              lastSeen: new Date(info.lastUpdate)
            }
          ).catch(console.error);
        }
      }

      console.log(`Connected devices: ${this.connectedDevices.size}`);
    }, 60 * 1000);
  }

  getConnectedDevices() {
    return Array.from(this.connectedDevices.entries()).map(([imei, info]) => ({
      imei,
      device: info.device,
      lastUpdate: new Date(info.lastUpdate),
      connectionCount: info.connectionCount
    }));
  }
}

module.exports = new GPSServer();