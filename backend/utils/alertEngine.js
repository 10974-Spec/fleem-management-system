const Alert = require('../models/Alert');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');

const alertConfigs = {
  Speeding: {
    threshold: 120,
    severity: 'High',
    check: (data, vehicle) => data.speed > 120
  },
  GeofenceEnter: {
    severity: 'Medium',
    check: async (data, vehicle) => {
      return false;
    }
  },
  GeofenceExit: {
    severity: 'Medium',
    check: async (data, vehicle) => {
      return false;
    }
  },
  FuelDrop: {
    threshold: 10,
    severity: 'High',
    check: (data, vehicle) => {
      if (data.fuelLevel !== undefined && vehicle.lastFuelLevel !== undefined) {
        return vehicle.lastFuelLevel - data.fuelLevel > 10;
      }
      return false;
    }
  },
  IgnitionOn: {
    severity: 'Low',
    check: (data, vehicle) => data.ignition === true
  },
  IgnitionOff: {
    severity: 'Low',
    check: (data, vehicle) => data.ignition === false
  },
  DeviceOffline: {
    threshold: 15,
    severity: 'Medium',
    check: async (device) => {
      const lastSeen = new Date(device.lastSeen);
      const now = new Date();
      const minutesOffline = (now - lastSeen) / (1000 * 60);
      return minutesOffline > 15;
    }
  }
};

exports.checkAlerts = async (gpsData, device) => {
  const alerts = [];
  const vehicle = device.vehicleId ? await Vehicle.findById(device.vehicleId) : null;

  for (const [alertType, config] of Object.entries(alertConfigs)) {
    let shouldAlert = false;
    
    try {
      if (alertType === 'DeviceOffline') {
        continue;
      }

      if (config.check.constructor.name === 'AsyncFunction') {
        shouldAlert = await config.check(gpsData, vehicle);
      } else {
        shouldAlert = config.check(gpsData, vehicle);
      }

      if (shouldAlert) {
        const existingAlert = await Alert.findOne({
          deviceId: device._id,
          type: alertType,
          status: 'New',
          createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
        });

        if (!existingAlert) {
          const alert = new Alert({
            tenantId: device.tenantId,
            vehicleId: device.vehicleId,
            deviceId: device._id,
            type: alertType,
            severity: config.severity,
            message: generateAlertMessage(alertType, gpsData, config),
            data: {
              speed: gpsData.speed,
              location: { lat: gpsData.lat, lng: gpsData.lng },
              timestamp: gpsData.timestamp
            }
          });

          await alert.save();
          alerts.push(alert);

          await sendNotification(alert);
        }
      }
    } catch (error) {
      console.error(`Error checking ${alertType} alert:`, error);
    }
  }

  return alerts;
};

exports.checkDeviceOfflineAlerts = async () => {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
  
  const offlineDevices = await require('../models/GPSDevice').find({
    status: 'Connected',
    lastSeen: { $lt: fifteenMinutesAgo }
  });

  for (const device of offlineDevices) {
    const existingAlert = await Alert.findOne({
      deviceId: device._id,
      type: 'DeviceOffline',
      status: 'New'
    });

    if (!existingAlert) {
      const alert = new Alert({
        tenantId: device.tenantId,
        vehicleId: device.vehicleId,
        deviceId: device._id,
        type: 'DeviceOffline',
        severity: 'Medium',
        message: `Device ${device.imei} has been offline for more than 15 minutes`,
        data: {
          lastSeen: device.lastSeen,
          imei: device.imei
        }
      });

      await alert.save();
      device.status = 'Offline';
      await device.save();

      await sendNotification(alert);
    }
  }
};

function generateAlertMessage(type, data, config) {
  const messages = {
    Speeding: `Vehicle exceeded speed limit: ${data.speed.toFixed(1)} km/h`,
    FuelDrop: `Significant fuel drop detected: ${config.threshold}%`,
    IgnitionOn: 'Vehicle ignition turned ON',
    IgnitionOff: 'Vehicle ignition turned OFF',
    DeviceOffline: `Device offline for more than ${config.threshold} minutes`
  };

  return messages[type] || `${type} alert triggered`;
}

async function sendNotification(alert) {
  console.log(`Notification: ${alert.message}`);
}