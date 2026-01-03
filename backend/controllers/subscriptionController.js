const Tenant = require('../models/Tenant');
const SubscriptionPlan = require('../models/SubscriptionPlan');
const PaymentTransaction = require('../models/PaymentTransaction');

exports.getPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true });
    res.json(plans);
  } catch (error) {
    console.error('Get plans error:', error);
    res.status(500).json({ error: 'Failed to get subscription plans' });
  }
};

exports.getCurrentSubscription = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const plan = await SubscriptionPlan.findOne({ name: tenant.plan });
    const recentPayments = await PaymentTransaction.find({
      tenantId: tenant._id,
      status: 'Completed'
    })
    .sort({ createdAt: -1 })
    .limit(5);

    res.json({
      currentPlan: tenant.plan,
      planDetails: plan,
      subscriptionEndsAt: tenant.subscriptionEndsAt,
      vehicleLimit: tenant.vehicleLimit,
      currentVehicleCount: tenant.currentVehicleCount,
      recentPayments
    });
  } catch (error) {
    console.error('Get subscription error:', error);
    res.status(500).json({ error: 'Failed to get subscription details' });
  }
};

exports.upgradeToPremium = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (tenant.plan === 'Premium') {
      return res.status(400).json({ error: 'Already on Premium plan' });
    }

    const premiumPlan = await SubscriptionPlan.findOne({ name: 'Premium' });
    if (!premiumPlan) {
      return res.status(500).json({ error: 'Premium plan not configured' });
    }

    const paymentTransaction = new PaymentTransaction({
      tenantId: tenant._id,
      subscriptionPlan: 'Premium',
      amount: premiumPlan.price,
      currency: premiumPlan.currency,
      paymentMethod: 'Mpesa',
      status: 'Pending'
    });

    await paymentTransaction.save();

    res.json({
      message: 'Payment initiated. Please complete M-Pesa payment.',
      transactionId: paymentTransaction._id,
      amount: paymentTransaction.amount,
      currency: paymentTransaction.currency,
      phoneNumber: req.body.phoneNumber
    });
  } catch (error) {
    console.error('Upgrade error:', error);
    res.status(500).json({ error: 'Failed to initiate upgrade' });
  }
};

exports.checkVehicleLimit = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const plan = await SubscriptionPlan.findOne({ name: tenant.plan });
    
    res.json({
      plan: tenant.plan,
      vehicleLimit: tenant.vehicleLimit,
      currentVehicleCount: tenant.currentVehicleCount,
      remainingSlots: Math.max(0, tenant.vehicleLimit - tenant.currentVehicleCount),
      canAddMore: tenant.currentVehicleCount < tenant.vehicleLimit,
      requiresUpgrade: tenant.plan === 'Free' && tenant.currentVehicleCount >= tenant.vehicleLimit
    });
  } catch (error) {
    console.error('Check vehicle limit error:', error);
    res.status(500).json({ error: 'Failed to check vehicle limit' });
  }
};

exports.getBillingHistory = async (req, res) => {
  try {
    const payments = await PaymentTransaction.find({
      tenantId: req.user.tenantId
    })
    .sort({ createdAt: -1 });

    res.json(payments);
  } catch (error) {
    console.error('Get billing history error:', error);
    res.status(500).json({ error: 'Failed to get billing history' });
  }
};