const { Inngest } = require('inngest');
const redisService = require('../services/redisService');
const notificationService = require('../services/notificationService');
const Alert = require('../models/Alert');

const inngest = new Inngest({
  id: 'fleet-alerts',
  eventKey: process.env.INNGEST_EVENT_KEY
});

exports.alertCreated = inngest.createFunction(
  { id: 'alert-created' },
  { event: 'alert.created' },
  async ({ event }) => {
    try {
      const { alertId, tenantId } = event.data;
      
      const alert = await Alert.findById(alertId)
        .populate('vehicleId', 'name plateNumber')
        .populate('driverId', 'name');

      if (!alert) {
        throw new Error(`Alert ${alertId} not found`);
      }

      await redisService.cacheAlert(tenantId, alert);

      await notificationService.sendAlertNotification(alert);

      if (alert.severity === 'Critical') {
        await this.sendCriticalAlertNotification(alert);
      }

      console.log(`Alert ${alertId} processed successfully`);
      
      return { success: true, alertId };
    } catch (error) {
      console.error('Error processing alert created event:', error);
      
      await redisService.publish('alert_processing_error', {
        alertId: event.data.alertId,
        error: error.message,
        timestamp: new Date()
      });
      
      throw error;
    }
  }
);

exports.sendCriticalAlertNotification = async (alert) => {
  try {
    await redisService.publish('critical_alert', {
      alertId: alert._id,
      type: alert.type,
      vehicleId: alert.vehicleId,
      timestamp: new Date(),
      priority: 'HIGH'
    });

    console.log(`Critical alert ${alert._id} escalated`);
  } catch (error) {
    console.error('Error sending critical alert:', error);
  }
};

exports.alertAcknowledged = inngest.createFunction(
  { id: 'alert-acknowledged' },
  { event: 'alert.acknowledged' },
  async ({ event }) => {
    try {
      const { alertId, acknowledgedBy } = event.data;
      
      await redisService.publish('alert_acknowledged', {
        alertId,
        acknowledgedBy,
        timestamp: new Date()
      });

      console.log(`Alert ${alertId} acknowledged event processed`);
      
      return { success: true };
    } catch (error) {
      console.error('Error processing alert acknowledged event:', error);
      throw error;
    }
  }
);