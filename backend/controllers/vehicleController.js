const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const GPSDevice = require('../models/GPSDevice');
const GPSData = require('../models/GPSData');
const Tenant = require('../models/Tenant');
const Alert = require('../models/Alert');

exports.getAllVehicles = async (req, res) => {
  try {
    const { status, vehicleType } = req.query;
    const filter = { tenantId: req.user.tenantId };
    
    if (status) filter.status = status;
    if (vehicleType) filter.vehicleType = vehicleType;

    const vehicles = await Vehicle.find(filter)
      .populate('currentDriver', 'name email phone')
      .populate({
        path: 'deviceId',
        select: 'imei brand status lastSeen'
      });

    const vehiclesWithLatestData = await Promise.all(
      vehicles.map(async (vehicle) => {
        const latestData = await GPSData.findOne({ vehicleId: vehicle._id })
          .sort({ timestamp: -1 })
          .select('lat lng speed heading ignition timestamp')
          .lean();
        
        return {
          ...vehicle.toObject(),
          latestLocation: latestData || null
        };
      })
    );

    res.json(vehiclesWithLatestData);
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ error: 'Failed to get vehicles' });
  }
};

exports.getVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    })
    .populate('currentDriver', 'name email phone')
    .populate({
      path: 'deviceId',
      select: 'imei brand status lastSeen phoneNumber'
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    const latestData = await GPSData.findOne({ vehicleId: vehicle._id })
      .sort({ timestamp: -1 })
      .lean();

    const totalTrips = await GPSData.distinct('timestamp', {
      vehicleId: vehicle._id,
      timestamp: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
    });

    const recentAlerts = await Alert.find({
      vehicleId: vehicle._id,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    })
    .sort({ createdAt: -1 })
    .limit(10);

    res.json({
      vehicle,
      latestLocation: latestData,
      stats: {
        totalTrips: totalTrips.length,
        recentAlerts: recentAlerts.length
      },
      recentAlerts
    });
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({ error: 'Failed to get vehicle' });
  }
};

exports.createVehicle = async (req, res) => {
  try {
    const tenant = await Tenant.findById(req.user.tenantId);
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (tenant.plan === 'Free' && tenant.currentVehicleCount >= tenant.vehicleLimit) {
      return res.status(400).json({ 
        error: `Vehicle limit reached. Free plan allows only ${tenant.vehicleLimit} vehicles. Upgrade to Premium.` 
      });
    }

    const { name, plateNumber, vehicleType, fuelType, year, make, model, currentDriver } = req.body;

    if (!name || !plateNumber) {
      return res.status(400).json({ error: 'Name and plate number are required' });
    }

    const existingVehicle = await Vehicle.findOne({ 
      tenantId: req.user.tenantId,
      plateNumber 
    });
    if (existingVehicle) {
      return res.status(400).json({ error: 'Vehicle with this plate number already exists' });
    }

    if (currentDriver) {
      const driver = await User.findOne({
        _id: currentDriver,
        tenantId: req.user.tenantId,
        role: 'Driver'
      });
      if (!driver) {
        return res.status(400).json({ error: 'Invalid driver selected' });
      }
    }

    const vehicle = new Vehicle({
      tenantId: req.user.tenantId,
      name,
      plateNumber,
      vehicleType,
      fuelType,
      year,
      make,
      model,
      currentDriver
    });

    await vehicle.save();
    tenant.currentVehicleCount += 1;
    await tenant.save();

    res.status(201).json({
      message: 'Vehicle created successfully',
      vehicle
    });
  } catch (error) {
    console.error('Create vehicle error:', error);
    res.status(500).json({ error: 'Failed to create vehicle' });
  }
};

exports.updateVehicle = async (req, res) => {
  try {
    const { name, plateNumber, vehicleType, fuelType, status, currentDriver } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (plateNumber) updates.plateNumber = plateNumber;
    if (vehicleType) updates.vehicleType = vehicleType;
    if (fuelType) updates.fuelType = fuelType;
    if (status) updates.status = status;
    if (currentDriver !== undefined) {
      if (currentDriver) {
        const driver = await User.findOne({
          _id: currentDriver,
          tenantId: req.user.tenantId,
          role: 'Driver'
        });
        if (!driver) {
          return res.status(400).json({ error: 'Invalid driver selected' });
        }
        updates.currentDriver = currentDriver;
      } else {
        updates.currentDriver = null;
      }
    }

    const vehicle = await Vehicle.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    res.json({
      message: 'Vehicle updated successfully',
      vehicle
    });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({ error: 'Failed to update vehicle' });
  }
};

exports.deleteVehicle = async (req, res) => {
  try {
    const vehicle = await Vehicle.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });

    if (!vehicle) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }

    await Tenant.findByIdAndUpdate(req.user.tenantId, {
      $inc: { currentVehicleCount: -1 }
    });

    await GPSDevice.updateMany(
      { vehicleId: vehicle._id },
      { $set: { vehicleId: null } }
    );

    res.json({ message: 'Vehicle deleted successfully' });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ error: 'Failed to delete vehicle' });
  }
};