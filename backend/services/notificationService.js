const redisService = require('./redisService');
const websocketService = require('./websocketService');
const Alert = require('../models/Alert');

class NotificationService {
  async sendAlertNotification(alert) {
    try {
      await redisService.cacheAlert(alert.tenantId, alert);
      
      websocketService.emitAlert(alert.tenantId, {
        id: alert._id,
        type: alert.type,
        severity: alert.severity,
        message: alert.message,
        vehicleId: alert.vehicleId,
        timestamp: alert.createdAt
      });

      console.log(`Alert notification sent: ${alert.message}`);
      
      return true;
    } catch (error) {
      console.error('Send alert notification error:', error);
      return false;
    }
  }

  async sendLocationUpdate(tenantId, vehicleId, location) {
    try {
      websocketService.emitLocationUpdate(tenantId, vehicleId, location);
      
      await redisService.publish('location_updates', {
        tenantId,
        vehicleId,
        location
      });

      return true;
    } catch (error) {
      console.error('Send location update error:', error);
      return false;
    }
  }

  async sendSubscriptionNotification(tenantId, message, type = 'info') {
    try {
      websocketService.broadcastToTenant(tenantId, 'notification', {
        type,
        message,
        timestamp: new Date()
      });

      return true;
    } catch (error) {
      console.error('Send subscription notification error:', error);
      return false;
    }
  }

  async sendMaintenanceReminder(tenantId, vehicleId, maintenance) {
    try {
      const notification = {
        type: 'maintenance',
        message: `Maintenance due for vehicle: ${maintenance.description}`,
        data: {
          vehicleId,
          maintenanceId: maintenance._id,
          dueDate: maintenance.nextDueDate
        },
        timestamp: new Date()
      };

      websocketService.broadcastToTenant(tenantId, 'notification', notification);

      return true;
    } catch (error) {
      console.error('Send maintenance reminder error:', error);
      return false;
    }
  }
}

module.exports = new NotificationService();