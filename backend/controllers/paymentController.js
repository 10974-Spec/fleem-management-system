const PaymentTransaction = require('../models/PaymentTransaction');
const Tenant = require('../models/Tenant');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const mpesaService = require('../services/mpesaService');

exports.initiatePayment = async (req, res) => {
  try {
    const { phoneNumber, subscriptionPlan } = req.body;
    
    if (!phoneNumber || !subscriptionPlan) {
      return res.status(400).json({ error: 'Phone number and subscription plan required' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const plan = await SubscriptionPlan.findOne({ name: subscriptionPlan });
    if (!plan) {
      return res.status(400).json({ error: 'Invalid subscription plan' });
    }

    const paymentTransaction = new PaymentTransaction({
      tenantId: tenant._id,
      subscriptionPlan,
      amount: plan.price,
      currency: plan.currency,
      paymentMethod: 'Mpesa',
      phoneNumber,
      status: 'Pending'
    });

    await paymentTransaction.save();

    try {
      const mpesaResponse = await mpesaService.initiateSTKPush(
        phoneNumber,
        plan.price,
        paymentTransaction._id.toString()
      );

      paymentTransaction.mpesaReference = mpesaResponse.CheckoutRequestID;
      paymentTransaction.transactionId = mpesaResponse.MerchantRequestID;
      await paymentTransaction.save();

      res.json({
        message: 'Payment request sent to your phone',
        transactionId: paymentTransaction._id,
        mpesaReference: paymentTransaction.mpesaReference,
        amount: paymentTransaction.amount,
        status: 'Pending'
      });
    } catch (mpesaError) {
      paymentTransaction.status = 'Failed';
      paymentTransaction.metadata = { error: mpesaError.message };
      await paymentTransaction.save();
      
      throw mpesaError;
    }
  } catch (error) {
    console.error('Initiate payment error:', error);
    res.status(500).json({ error: 'Failed to initiate payment' });
  }
};

exports.paymentCallback = async (req, res) => {
  try {
    const callbackData = req.body;
    
    if (callbackData.Body.stkCallback.ResultCode === 0) {
      const { CheckoutRequestID, MpesaReceiptNumber, Amount, PhoneNumber } = 
        callbackData.Body.stkCallback.CallbackMetadata.Item;
      
      const transaction = await PaymentTransaction.findOne({
        mpesaReference: CheckoutRequestID
      });

      if (transaction) {
        transaction.status = 'Completed';
        transaction.mpesaReference = MpesaReceiptNumber;
        transaction.completedAt = new Date();
        transaction.metadata = {
          amount: Amount,
          phoneNumber: PhoneNumber,
          callbackData: callbackData.Body.stkCallback
        };
        await transaction.save();

        if (transaction.subscriptionPlan === 'Premium') {
          await activatePremiumSubscription(transaction.tenantId);
        }

        await sendPaymentConfirmation(transaction);
      }
    }

    res.json({ ResultCode: 0, ResultDesc: 'Success' });
  } catch (error) {
    console.error('Payment callback error:', error);
    res.status(500).json({ ResultCode: 1, ResultDesc: 'Failed' });
  }
};

exports.getPaymentStatus = async (req, res) => {
  try {
    const transaction = await PaymentTransaction.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status === 'Pending' && transaction.mpesaReference) {
      try {
        const status = await mpesaService.checkTransactionStatus(transaction.mpesaReference);
        if (status.ResultCode === 0) {
          transaction.status = 'Completed';
          transaction.completedAt = new Date();
          await transaction.save();
          
          if (transaction.subscriptionPlan === 'Premium') {
            await activatePremiumSubscription(transaction.tenantId);
          }
        }
      } catch (statusError) {
        console.error('Status check error:', statusError);
      }
    }

    res.json({
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      subscriptionPlan: transaction.subscriptionPlan,
      createdAt: transaction.createdAt,
      completedAt: transaction.completedAt
    });
  } catch (error) {
    console.error('Get payment status error:', error);
    res.status(500).json({ error: 'Failed to get payment status' });
  }
};

async function activatePremiumSubscription(tenantId) {
  const tenant = await Tenant.findById(tenantId);
  if (tenant) {
    tenant.plan = 'Premium';
    tenant.vehicleLimit = 9999;
    tenant.subscriptionEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await tenant.save();
  }
}

async function sendPaymentConfirmation(transaction) {
  console.log(`Payment confirmed for transaction ${transaction._id}`);
}