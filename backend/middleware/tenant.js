const Tenant = require('../models/Tenant');

exports.validateTenant = async (req, res, next) => {
  try {
    if (!req.user || !req.user.tenantId) {
      return res.status(401).json({ error: 'Tenant context required' });
    }

    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant || tenant.status !== 'Active') {
      return res.status(403).json({ error: 'Tenant account is not active' });
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    console.error('Tenant validation error:', error);
    res.status(500).json({ error: 'Failed to validate tenant' });
  }
};

exports.checkVehicleLimit = async (req, res, next) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (tenant.plan === 'Free' && tenant.currentVehicleCount >= tenant.vehicleLimit) {
      return res.status(400).json({ 
        error: `Vehicle limit reached (${tenant.vehicleLimit}). Upgrade to Premium.` 
      });
    }
    next();
  } catch (error) {
    console.error('Vehicle limit check error:', error);
    res.status(500).json({ error: 'Failed to check vehicle limit' });
  }
};