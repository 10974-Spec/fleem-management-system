const redisService = require('./redisService');
const inngestService = require('./inngestService');
const notificationService = require('./notificationService');
const Alert = require('../models/Alert');
const GPSDevice = require('../models/GPSDevice');

class EventHandlers {
  initialize() {
    this.setupRedisSubscriptions();
    this.startPeriodicJobs();
    console.log('Event handlers initialized');
  }

  setupRedisSubscriptions() {
    redisService.subscribe('vehicle_location', this.handleVehicleLocation.bind(this));
    redisService.subscribe('alert_created', this.handleAlertCreated.bind(this));
    redisService.subscribe('payment_completed', this.handlePaymentCompleted.bind(this));
    redisService.subscribe('device_offline', this.handleDeviceOffline.bind(this));
    redisService.subscribe('gps_processing_error', this.handleGPSProcessingError.bind(this));
  }

  async handleVehicleLocation(data) {
    try {
      const { vehicleId, tenantId, location } = data;
      
      await redisService.set(
        `vehicle:${vehicleId}:last_location`,
        location,
        300
      );

      await redisService.cacheVehicleLocations(tenantId, {
        [vehicleId]: location
      });

      await inngestService.sendLocationUpdate(vehicleId, tenantId, location);

      console.log(`Vehicle ${vehicleId} location updated:`, location);
    } catch (error) {
      console.error('Error handling vehicle location:', error);
    }
  }

  async handleAlertCreated(data) {
    try {
      const { alertId, tenantId } = data;
      
      const alert = await Alert.findById(alertId);
      if (!alert) {
        throw new Error(`Alert ${alertId} not found`);
      }

      await inngestService.sendAlertCreated(alertId, tenantId);

      await redisService.publish('alert_notification', {
        alertId,
        tenantId,
        type: alert.type,
        severity: alert.severity
      });

      console.log(`Alert ${alertId} created event processed`);
    } catch (error) {
      console.error('Error handling alert created:', error);
    }
  }

  async handlePaymentCompleted(data) {
    try {
      const { transactionId, tenantId } = data;
      
      await inngestService.sendPaymentCompleted(transactionId, tenantId);

      console.log(`Payment ${transactionId} completed event processed`);
    } catch (error) {
      console.error('Error handling payment completed:', error);
    }
  }

  async handleDeviceOffline(data) {
    try {
      const { deviceId, imei, lastSeen } = data;
      
      await GPSDevice.findByIdAndUpdate(deviceId, {
        status: 'Offline',
        lastSeen: new Date(lastSeen)
      });

      await redisService.publish('device_status_change', {
        deviceId,
        imei,
        status: 'Offline',
        timestamp: new Date()
      });

      console.log(`Device ${imei} marked as offline`);
    } catch (error) {
      console.error('Error handling device offline:', error);
    }
  }

  async handleGPSProcessingError(data) {
    try {
      const { deviceId, imei, error, timestamp } = data;
      
      console.error(`GPS processing error for device ${imei}:`, error);

      await redisService.set(
        `device:${deviceId}:last_error`,
        { error, timestamp },
        3600
      );

      const errorCount = await redisService.get(`device:${deviceId}:error_count`) || 0;
      await redisService.set(
        `device:${deviceId}:error_count`,
        errorCount + 1,
        3600
      );

      if (errorCount + 1 >= 10) {
        await this.handleExcessiveErrors(deviceId, imei);
      }
    } catch (error) {
      console.error('Error handling GPS processing error:', error);
    }
  }

  async handleExcessiveErrors(deviceId, imei) {
    try {
      await GPSDevice.findByIdAndUpdate(deviceId, {
        status: 'Disabled',
        config: { disabledReason: 'Excessive errors' }
      });

      await redisService.publish('device_disabled', {
        deviceId,
        imei,
        reason: 'Excessive GPS processing errors',
        timestamp: new Date()
      });

      console.log(`Device ${imei} disabled due to excessive errors`);
    } catch (error) {
      console.error('Error handling excessive errors:', error);
    }
  }

  startPeriodicJobs() {
    setInterval(() => {
      this.cleanupOldLocations();
    }, 30 * 60 * 1000);

    setInterval(() => {
      this.checkAlertStatistics();
    }, 60 * 60 * 1000);

    setInterval(() => {
      this.backupRedisData();
    }, 24 * 60 * 60 * 1000);
  }

  async cleanupOldLocations() {
    try {
      const keys = await redisService.client.keys('vehicle:*:last_location');
      const now = Date.now();
      const threshold = 24 * 60 * 60 * 1000;

      for (const key of keys) {
        const location = await redisService.get(key);
        if (location && now - new Date(location.timestamp).getTime() > threshold) {
          await redisService.del(key);
        }
      }

      console.log('Old location cache cleaned up');
    } catch (error) {
      console.error('Error cleaning up old locations:', error);
    }
  }

  async checkAlertStatistics() {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const alertCount = await Alert.countDocuments({
        createdAt: { $gte: today }
      });

      await redisService.set(
        'stats:alerts:today',
        { count: alertCount, updatedAt: new Date() },
        86400
      );

      console.log(`Today's alert count: ${alertCount}`);
    } catch (error) {
      console.error('Error checking alert statistics:', error);
    }
  }

  async backupRedisData() {
    try {
      const stats = {
        connectedDevices: await redisService.client.dbsize(),
        timestamp: new Date()
      };

      await redisService.set('backup:stats', stats, 7 * 86400);

      console.log('Redis data backed up:', stats);
    } catch (error) {
      console.error('Error backing up Redis data:', error);
    }
  }
}

module.exports = new EventHandlers();