const { Inngest } = require('inngest');
const { serve } = require('inngest/express');
const alertEvents = require('../events/alertEvents');
const paymentEvents = require('../events/paymentEvents');

class InngestService {
  constructor() {
    this.inngest = new Inngest({
      id: 'fleet-management',
      eventKey: process.env.INNGEST_EVENT_KEY,
      env: process.env.NODE_ENV || 'development'
    });

    this.functions = [
      alertEvents.alertCreated,
      alertEvents.alertAcknowledged,
      paymentEvents.paymentCompleted,
      paymentEvents.paymentFailed
    ];
  }

  initialize(app) {
    const inngestHandler = serve({
      client: this.inngest,
      functions: this.functions,
      signingKey: process.env.INNGEST_SIGNING_KEY
    });

    app.use('/api/inngest', inngestHandler);
    console.log('Inngest service initialized');
  }

  async sendEvent(eventName, data) {
    try {
      await this.inngest.send({
        name: eventName,
        data,
        v: '2023-10-24.1'
      });
      console.log(`Event ${eventName} sent successfully`);
      return true;
    } catch (error) {
      console.error(`Error sending event ${eventName}:`, error);
      return false;
    }
  }

  async sendAlertCreated(alertId, tenantId) {
    return await this.sendEvent('alert.created', {
      alertId,
      tenantId
    });
  }

  async sendAlertAcknowledged(alertId, acknowledgedBy) {
    return await this.sendEvent('alert.acknowledged', {
      alertId,
      acknowledgedBy
    });
  }

  async sendPaymentCompleted(transactionId, tenantId) {
    return await this.sendEvent('payment.completed', {
      transactionId,
      tenantId
    });
  }

  async sendPaymentFailed(transactionId, tenantId, error) {
    return await this.sendEvent('payment.failed', {
      transactionId,
      tenantId,
      error
    });
  }

  async sendLocationUpdate(vehicleId, tenantId, location) {
    return await this.sendEvent('location.updated', {
      vehicleId,
      tenantId,
      location,
      timestamp: new Date()
    });
  }

  async sendDeviceStatusUpdate(deviceId, status) {
    return await this.sendEvent('device.status.updated', {
      deviceId,
      status,
      timestamp: new Date()
    });
  }
}

module.exports = new InngestService();