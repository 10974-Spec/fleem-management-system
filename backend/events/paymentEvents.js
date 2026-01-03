const { Inngest } = require('inngest');
const Tenant = require('../models/Tenant');
const PaymentTransaction = require('../models/PaymentTransaction');
const notificationService = require('../services/notificationService');

const inngest = new Inngest({
  id: 'fleet-payments',
  eventKey: process.env.INNGEST_EVENT_KEY
});

exports.paymentCompleted = inngest.createFunction(
  { id: 'payment-completed' },
  { event: 'payment.completed' },
  async ({ event }) => {
    try {
      const { transactionId, tenantId } = event.data;
      
      const transaction = await PaymentTransaction.findById(transactionId);
      if (!transaction) {
        throw new Error(`Transaction ${transactionId} not found`);
      }

      if (transaction.subscriptionPlan === 'Premium') {
        await this.activatePremiumSubscription(tenantId);
      }

      await notificationService.sendSubscriptionNotification(
        tenantId,
        `Payment completed for ${transaction.subscriptionPlan} plan`,
        'success'
      );

      console.log(`Payment ${transactionId} processed successfully`);
      
      return { success: true, transactionId };
    } catch (error) {
      console.error('Error processing payment completed event:', error);
      throw error;
    }
  }
);

exports.activatePremiumSubscription = async (tenantId) => {
  try {
    const tenant = await Tenant.findById(tenantId);
    if (!tenant) {
      throw new Error(`Tenant ${tenantId} not found`);
    }

    tenant.plan = 'Premium';
    tenant.vehicleLimit = 9999;
    tenant.subscriptionEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await tenant.save();

    console.log(`Tenant ${tenantId} upgraded to Premium`);
    
    return { success: true };
  } catch (error) {
    console.error('Error activating premium subscription:', error);
    throw error;
  }
};

exports.paymentFailed = inngest.createFunction(
  { id: 'payment-failed' },
  { event: 'payment.failed' },
  async ({ event }) => {
    try {
      const { transactionId, tenantId, error } = event.data;
      
      await PaymentTransaction.findByIdAndUpdate(transactionId, {
        status: 'Failed',
        metadata: { error }
      });

      await notificationService.sendSubscriptionNotification(
        tenantId,
        `Payment failed: ${error}`,
        'error'
      );

      console.log(`Payment ${transactionId} marked as failed`);
      
      return { success: true };
    } catch (error) {
      console.error('Error processing payment failed event:', error);
      throw error;
    }
  }
);