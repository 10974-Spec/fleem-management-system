const Alert = require('../models/Alert');
const redisService = require('../services/redisService');
const inngestService = require('../services/inngestService');

class EnhancedAlertEngine {
  constructor() {
    this.alertCooldowns = new Map();
    this.geofences = new Map();
  }

  async checkAlerts(gpsData, device) {
    const alerts = [];

    alerts.push(...await this.checkSpeeding(gpsData, device));
    alerts.push(...await this.checkGeofence(gpsData, device));
    alerts.push(...await this.checkFuel(gpsData, device));
    alerts.push(...await this.checkIgnition(gpsData, device));
    alerts.push(...await this.checkMaintenance(gpsData, device));

    for (const alert of alerts) {
      if (await this.shouldCreateAlert(alert, device)) {
        await this.createAlert(alert, device);
      }
    }

    return alerts;
  }

  async checkSpeeding(gpsData, device) {
    const alerts = [];
    
    const speedLimit = await this.getSpeedLimit(device.tenantId, device.vehicleId);
    if (gpsData.speed > speedLimit) {
      alerts.push({
        type: 'Speeding',
        severity: gpsData.speed > speedLimit * 1.3 ? 'High' : 'Medium',
        message: `Vehicle exceeding speed limit: ${gpsData.speed.toFixed(1)} km/h (Limit: ${speedLimit} km/h)`,
        data: {
          speed: gpsData.speed,
          speedLimit,
          location: { lat: gpsData.lat, lng: gpsData.lng }
        }
      });
    }

    return alerts;
  }

  async checkGeofence(gpsData, device) {
    const alerts = [];
    
    if (!device.vehicleId) return alerts;

    const geofences = await this.getGeofences(device.tenantId, device.vehicleId);
    
    for (const geofence of geofences) {
      const isInside = this.isPointInGeofence(gpsData.lat, gpsData.lng, geofence);
      const wasInside = await this.wasVehicleInGeofence(device.vehicleId, geofence.id);
      
      if (isInside && !wasInside) {
        alerts.push({
          type: 'GeofenceEnter',
          severity: 'Medium',
          message: `Vehicle entered geofence: ${geofence.name}`,
          data: {
            geofenceId: geofence.id,
            geofenceName: geofence.name,
            location: { lat: gpsData.lat, lng: gpsData.lng }
          }
        });
      } else if (!isInside && wasInside) {
        alerts.push({
          type: 'GeofenceExit',
          severity: 'Medium',
          message: `Vehicle exited geofence: ${geofence.name}`,
          data: {
            geofenceId: geofence.id,
            geofenceName: geofence.name,
            location: { lat: gpsData.lat, lng: gpsData.lng }
          }
        });
      }

      await this.updateGeofenceStatus(device.vehicleId, geofence.id, isInside);
    }

    return alerts;
  }

  async checkFuel(gpsData, device) {
    const alerts = [];
    
    if (gpsData.fuelLevel !== undefined) {
      const lastFuel = await this.getLastFuelLevel(device.vehicleId);
      
      if (lastFuel !== null && lastFuel - gpsData.fuelLevel > 10) {
        alerts.push({
          type: 'FuelDrop',
          severity: 'High',
          message: `Significant fuel drop detected: ${(lastFuel - gpsData.fuelLevel).toFixed(1)}%`,
          data: {
            previousFuel: lastFuel,
            currentFuel: gpsData.fuelLevel,
            dropAmount: lastFuel - gpsData.fuelLevel,
            location: { lat: gpsData.lat, lng: gpsData.lng }
          }
        });
      }

      await this.updateFuelLevel(device.vehicleId, gpsData.fuelLevel);
    }

    return alerts;
  }

  async checkIgnition(gpsData, device) {
    const alerts = [];
    
    const lastIgnition = await this.getLastIgnitionStatus(device.vehicleId);
    
    if (lastIgnition !== null && lastIgnition !== gpsData.ignition) {
      alerts.push({
        type: gpsData.ignition ? 'IgnitionOn' : 'IgnitionOff',
        severity: 'Low',
        message: `Ignition ${gpsData.ignition ? 'turned ON' : 'turned OFF'}`,
        data: {
          previousState: lastIgnition,
          currentState: gpsData.ignition,
          location: { lat: gpsData.lat, lng: gpsData.lng }
        }
      });
    }

    await this.updateIgnitionStatus(device.vehicleId, gpsData.ignition);

    return alerts;
  }

  async checkMaintenance(gpsData, device) {
    const alerts = [];
    
    if (!device.vehicleId) return alerts;

    const upcomingMaintenance = await this.getUpcomingMaintenance(device.vehicleId);
    
    for (const maintenance of upcomingMaintenance) {
      const daysRemaining = Math.ceil((maintenance.nextDueDate - new Date()) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining <= 7 && daysRemaining > 0) {
        alerts.push({
          type: 'MaintenanceDue',
          severity: 'Medium',
          message: `Maintenance due in ${daysRemaining} days: ${maintenance.description}`,
          data: {
            maintenanceId: maintenance._id,
            description: maintenance.description,
            dueDate: maintenance.nextDueDate,
            daysRemaining
          }
        });
      }
    }

    return alerts;
  }

  async shouldCreateAlert(alertData, device) {
    const cooldownKey = `${device.vehicleId}:${alertData.type}`;
    
    if (this.alertCooldowns.has(cooldownKey)) {
      const lastAlertTime = this.alertCooldowns.get(cooldownKey);
      const cooldown = this.getCooldownForAlertType(alertData.type);
      
      if (Date.now() - lastAlertTime < cooldown) {
        return false;
      }
    }

    const existingAlert = await Alert.findOne({
      deviceId: device._id,
      type: alertData.type,
      status: 'New',
      createdAt: { $gte: new Date(Date.now() - 5 * 60 * 1000) }
    });

    return !existingAlert;
  }

  async createAlert(alertData, device) {
    try {
      const alert = new Alert({
        tenantId: device.tenantId,
        vehicleId: device.vehicleId,
        deviceId: device._id,
        ...alertData
      });

      await alert.save();

      this.alertCooldowns.set(`${device.vehicleId}:${alertData.type}`, Date.now());

      await redisService.publish('alert_created', {
        alertId: alert._id,
        tenantId: device.tenantId
      });

      await inngestService.sendAlertCreated(alert._id, device.tenantId);

      return alert;
    } catch (error) {
      console.error('Error creating alert:', error);
      throw error;
    }
  }

  getCooldownForAlertType(type) {
    const cooldowns = {
      Speeding: 5 * 60 * 1000,
      GeofenceEnter: 1 * 60 * 1000,
      GeofenceExit: 1 * 60 * 1000,
      FuelDrop: 30 * 60 * 1000,
      IgnitionOn: 1 * 60 * 1000,
      IgnitionOff: 1 * 60 * 1000,
      MaintenanceDue: 24 * 60 * 60 * 1000,
      DeviceOffline: 15 * 60 * 1000
    };

    return cooldowns[type] || 5 * 60 * 1000;
  }

  async getSpeedLimit(tenantId, vehicleId) {
    const cached = await redisService.get(`tenant:${tenantId}:speed_limit`);
    if (cached) return cached;

    return 120;
  }

  async getGeofences(tenantId, vehicleId) {
    return [];
  }

  isPointInGeofence(lat, lng, geofence) {
    return false;
  }

  async wasVehicleInGeofence(vehicleId, geofenceId) {
    const key = `vehicle:${vehicleId}:geofence:${geofenceId}`;
    return await redisService.get(key) || false;
  }

  async updateGeofenceStatus(vehicleId, geofenceId, isInside) {
    const key = `vehicle:${vehicleId}:geofence:${geofenceId}`;
    await redisService.set(key, isInside, 3600);
  }

  async getLastFuelLevel(vehicleId) {
    const key = `vehicle:${vehicleId}:fuel_level`;
    return await redisService.get(key);
  }

  async updateFuelLevel(vehicleId, level) {
    const key = `vehicle:${vehicleId}:fuel_level`;
    await redisService.set(key, level, 3600);
  }

  async getLastIgnitionStatus(vehicleId) {
    const key = `vehicle:${vehicleId}:ignition`;
    return await redisService.get(key);
  }

  async updateIgnitionStatus(vehicleId, status) {
    const key = `vehicle:${vehicleId}:ignition`;
    await redisService.set(key, status, 3600);
  }

  async getUpcomingMaintenance(vehicleId) {
    const Maintenance = require('../models/Maintenance');
    return await Maintenance.find({
      vehicleId,
      nextDueDate: { $gte: new Date() }
    }).sort({ nextDueDate: 1 });
  }
}

module.exports = new EnhancedAlertEngine();