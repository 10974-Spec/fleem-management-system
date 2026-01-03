const Tenant = require('../models/Tenant');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');

exports.getTenant = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const stats = await getTenantStats(req.user.tenantId);
    
    res.json({
      tenant,
      stats
    });
  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({ error: 'Failed to get tenant information' });
  }
};

exports.updateTenant = async (req, res) => {
  try {
    const { name, phone, timezone } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (phone) updates.phone = phone;
    if (timezone) updates.timezone = timezone;

    const tenant = await Tenant.findByIdAndUpdate(
      req.user.tenantId,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({
      message: 'Tenant updated successfully',
      tenant
    });
  } catch (error) {
    console.error('Update tenant error:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
};

exports.getTenantStats = async (req, res) => {
  try {
    const stats = await getTenantStats(req.user.tenantId);
    res.json(stats);
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
};

async function getTenantStats(tenantId) {
  const [
    totalVehicles,
    activeVehicles,
    totalDrivers,
    totalAlerts,
    pendingMaintenance
  ] = await Promise.all([
    Vehicle.countDocuments({ tenantId }),
    Vehicle.countDocuments({ tenantId, status: 'Active' }),
    User.countDocuments({ tenantId, role: 'Driver' }),
    require('../models/Alert').countDocuments({ tenantId, status: 'New' }),
    require('../models/Maintenance').countDocuments({ 
      tenantId,
      nextDueDate: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
    })
  ]);

  return {
    totalVehicles,
    activeVehicles,
    totalDrivers,
    totalAlerts,
    pendingMaintenance
  };
}