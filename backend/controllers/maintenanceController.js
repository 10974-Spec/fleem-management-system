const Maintenance = require('../models/Maintenance');
const Vehicle = require('../models/Vehicle');

exports.getAllMaintenance = async (req, res) => {
  try {
    const { vehicleId, type, upcoming } = req.query;
    const filter = { tenantId: req.user.tenantId };
    
    if (vehicleId) filter.vehicleId = vehicleId;
    if (type) filter.type = type;
    
    if (upcoming === 'true') {
      filter.nextDueDate = { $lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) };
    }

    const maintenance = await Maintenance.find(filter)
      .populate('vehicleId', 'name plateNumber')
      .sort({ date: -1 });

    res.json(maintenance);
  } catch (error) {
    console.error('Get maintenance error:', error);
    res.status(500).json({ error: 'Failed to get maintenance records' });
  }
};

exports.getMaintenance = async (req, res) => {
  try {
    const maintenance = await Maintenance.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    }).populate('vehicleId', 'name plateNumber vehicleType');

    if (!maintenance) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    res.json(maintenance);
  } catch (error) {
    console.error('Get maintenance record error:', error);
    res.status(500).json({ error: 'Failed to get maintenance record' });
  }
};

exports.createMaintenance = async (req, res) => {
  try {
    const { vehicleId, type, description, date, nextDueDate, odometerAtService, cost, serviceProvider, notes } = req.body;

    if (!vehicleId || !type || !description || !date) {
      return res.status(400).json({ error: 'Vehicle, type, description, and date are required' });
    }

    const vehicle = await Vehicle.findOne({
      _id: vehicleId,
      tenantId: req.user.tenantId
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const maintenance = new Maintenance({
      tenantId: req.user.tenantId,
      vehicleId,
      type,
      description,
      date: new Date(date),
      nextDueDate: nextDueDate ? new Date(nextDueDate) : null,
      odometerAtService,
      cost: cost || 0,
      serviceProvider,
      notes
    });

    await maintenance.save();

    res.status(201).json({
      message: 'Maintenance record created successfully',
      maintenance
    });
  } catch (error) {
    console.error('Create maintenance error:', error);
    res.status(500).json({ error: 'Failed to create maintenance record' });
  }
};

exports.updateMaintenance = async (req, res) => {
  try {
    const { type, description, date, nextDueDate, odometerAtService, cost, serviceProvider, notes } = req.body;
    const updates = {};

    if (type) updates.type = type;
    if (description) updates.description = description;
    if (date) updates.date = new Date(date);
    if (nextDueDate !== undefined) updates.nextDueDate = nextDueDate ? new Date(nextDueDate) : null;
    if (odometerAtService !== undefined) updates.odometerAtService = odometerAtService;
    if (cost !== undefined) updates.cost = cost;
    if (serviceProvider) updates.serviceProvider = serviceProvider;
    if (notes !== undefined) updates.notes = notes;

    const maintenance = await Maintenance.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { $set: updates },
      { new: true, runValidators: true }
    ).populate('vehicleId', 'name plateNumber');

    if (!maintenance) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    res.json({
      message: 'Maintenance record updated successfully',
      maintenance
    });
  } catch (error) {
    console.error('Update maintenance error:', error);
    res.status(500).json({ error: 'Failed to update maintenance record' });
  }
};

exports.deleteMaintenance = async (req, res) => {
  try {
    const maintenance = await Maintenance.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });

    if (!maintenance) {
      return res.status(404).json({ error: 'Maintenance record not found' });
    }

    res.json({ message: 'Maintenance record deleted successfully' });
  } catch (error) {
    console.error('Delete maintenance error:', error);
    res.status(500).json({ error: 'Failed to delete maintenance record' });
  }
};

exports.getUpcomingMaintenance = async (req, res) => {
  try {
    const thresholdDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    const upcoming = await Maintenance.find({
      tenantId: req.user.tenantId,
      nextDueDate: { $lte: thresholdDate },
      $or: [
        { nextDueDate: { $gt: new Date() } },
        { nextDueDate: null }
      ]
    })
    .populate('vehicleId', 'name plateNumber vehicleType')
    .sort({ nextDueDate: 1 });

    const overdue = await Maintenance.find({
      tenantId: req.user.tenantId,
      nextDueDate: { $lt: new Date(), $ne: null }
    })
    .populate('vehicleId', 'name plateNumber vehicleType')
    .sort({ nextDueDate: 1 });

    res.json({
      upcoming,
      overdue,
      count: upcoming.length + overdue.length
    });
  } catch (error) {
    console.error('Get upcoming maintenance error:', error);
    res.status(500).json({ error: 'Failed to get upcoming maintenance' });
  }
};