const GPSData = require('../models/GPSData');
const GPSDevice = require('../models/GPSDevice');
const Vehicle = require('../models/Vehicle');
const Alert = require('../models/Alert');
const gpsParsers = require('../utils/gpsParsers');
const alertEngine = require('../utils/alertEngine');

exports.receiveData = async (req, res) => {
  try {
    const { imei, data, protocol } = req.body;

    if (!imei || !data) {
      return res.status(400).json({ error: 'IMEI and data required' });
    }

    const device = await GPSDevice.findOne({ imei });
    if (!device) {
      return res.status(404).json({ error: 'Device not registered' });
    }

    let parsedData;
    try {
      parsedData = gpsParsers.parseData(data, protocol || device.brand);
    } catch (error) {
      console.error('GPS parsing error:', error);
      return res.status(400).json({ error: 'Invalid GPS data format' });
    }

    const gpsData = new GPSData({
      deviceId: device._id,
      vehicleId: device.vehicleId,
      ...parsedData,
      timestamp: new Date(parsedData.timestamp || Date.now()),
      rawData: data
    });

    await gpsData.save();

    device.lastSeen = new Date();
    device.status = 'Connected';
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
    }

    await alertEngine.checkAlerts(gpsData, device);

    res.json({ success: true, message: 'Data received' });
  } catch (error) {
    console.error('Receive data error:', error);
    res.status(500).json({ error: 'Failed to process GPS data' });
  }
};

exports.getVehicleHistory = async (req, res) => {
  try {
    const { vehicleId, startDate, endDate, limit = 1000 } = req.query;
    
    if (!vehicleId) {
      return res.status(400).json({ error: 'Vehicle ID required' });
    }

    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      tenantId: req.user.tenantId
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const filter = { vehicleId };
    
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    const data = await GPSData.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .select('lat lng speed heading ignition timestamp')
      .lean();

    res.json(data.reverse());
  } catch (error) {
    console.error('Get history error:', error);
    res.status(500).json({ error: 'Failed to get vehicle history' });
  }
};

exports.getLiveLocations = async (req, res) => {
  try {
    const vehicles = await Vehicle.find({ 
      tenantId: req.user.tenantId,
      status: 'Active'
    }).select('_id name plateNumber currentLocation');

    const locations = await Promise.all(
      vehicles.map(async (vehicle) => {
        if (vehicle.currentLocation && vehicle.currentLocation.lat) {
          const latestData = await GPSData.findOne({ vehicleId: vehicle._id })
            .sort({ timestamp: -1 })
            .select('speed heading ignition timestamp')
            .lean();

          return {
            vehicleId: vehicle._id,
            name: vehicle.name,
            plateNumber: vehicle.plateNumber,
            lat: vehicle.currentLocation.lat,
            lng: vehicle.currentLocation.lng,
            lastUpdated: vehicle.currentLocation.lastUpdated,
            speed: latestData?.speed || 0,
            heading: latestData?.heading || 0,
            ignition: latestData?.ignition || false
          };
        }
        return null;
      })
    );

    res.json(locations.filter(loc => loc !== null));
  } catch (error) {
    console.error('Get live locations error:', error);
    res.status(500).json({ error: 'Failed to get live locations' });
  }
};

exports.getTripSummary = async (req, res) => {
  try {
    const { vehicleId, date } = req.query;
    
    if (!vehicleId) {
      return res.status(400).json({ error: 'Vehicle ID required' });
    }

    const startDate = new Date(date || new Date().setHours(0, 0, 0, 0));
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const data = await GPSData.find({
      vehicleId,
      timestamp: { $gte: startDate, $lt: endDate }
    }).sort({ timestamp: 1 }).lean();

    if (data.length === 0) {
      return res.json({
        totalDistance: 0,
        totalTime: 0,
        maxSpeed: 0,
        averageSpeed: 0,
        idleTime: 0,
        stops: 0,
        tripPoints: []
      });
    }

    const tripPoints = data.map(point => ({
      lat: point.lat,
      lng: point.lng,
      timestamp: point.timestamp,
      speed: point.speed
    }));

    let totalDistance = 0;
    let totalTime = 0;
    let maxSpeed = 0;
    let idleTime = 0;
    let stops = 0;

    for (let i = 1; i < data.length; i++) {
      const prev = data[i - 1];
      const curr = data[i];
      
      const timeDiff = (curr.timestamp - prev.timestamp) / 1000;
      totalTime += timeDiff;

      const distance = calculateDistance(prev.lat, prev.lng, curr.lat, curr.lng);
      totalDistance += distance;

      maxSpeed = Math.max(maxSpeed, curr.speed || 0);

      if (curr.speed < 1) {
        idleTime += timeDiff;
      }

      if (curr.ignition !== prev.ignition) {
        stops++;
      }
    }

    const averageSpeed = totalTime > 0 ? (totalDistance / totalTime) * 3.6 : 0;

    res.json({
      totalDistance: parseFloat(totalDistance.toFixed(2)),
      totalTime: parseFloat(totalTime.toFixed(0)),
      maxSpeed: parseFloat(maxSpeed.toFixed(1)),
      averageSpeed: parseFloat(averageSpeed.toFixed(1)),
      idleTime: parseFloat(idleTime.toFixed(0)),
      stops,
      tripPoints
    });
  } catch (error) {
    console.error('Get trip summary error:', error);
    res.status(500).json({ error: 'Failed to get trip summary' });
  }
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}