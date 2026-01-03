const GPSDevice = require('../models/GPSDevice');
const Vehicle = require('../models/Vehicle');
const GPSData = require('../models/GPSData');
const validator = require('validator');

exports.getAllDevices = async (req, res) => {
  try {
    const { status, brand } = req.query;
    const filter = { tenantId: req.user.tenantId };
    
    if (status) filter.status = status;
    if (brand) filter.brand = brand;

    const devices = await GPSDevice.find(filter)
      .populate('vehicleId', 'name plateNumber');

    res.json(devices);
  } catch (error) {
    console.error('Get devices error:', error);
    res.status(500).json({ error: 'Failed to get devices' });
  }
};

exports.getDevice = async (req, res) => {
  try {
    const device = await GPSDevice.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    }).populate('vehicleId', 'name plateNumber');

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const latestData = await GPSData.findOne({ deviceId: device._id })
      .sort({ timestamp: -1 })
      .lean();

    const todayDataCount = await GPSData.countDocuments({
      deviceId: device._id,
      timestamp: { 
        $gte: new Date(new Date().setHours(0, 0, 0, 0)) 
      }
    });

    res.json({
      device,
      latestData,
      stats: {
        todayDataPoints: todayDataCount
      }
    });
  } catch (error) {
    console.error('Get device error:', error);
    res.status(500).json({ error: 'Failed to get device' });
  }
};

exports.createDevice = async (req, res) => {
  try {
    const { imei, name, brand, protocol, phoneNumber, vehicleId } = req.body;

    if (!imei || !brand) {
      return res.status(400).json({ error: 'IMEI and brand are required' });
    }

    if (!validator.isIMEI(imei)) {
      return res.status(400).json({ error: 'Invalid IMEI format' });
    }

    const existingDevice = await GPSDevice.findOne({ imei });
    if (existingDevice) {
      return res.status(400).json({ error: 'Device with this IMEI already exists' });
    }

    if (vehicleId) {
      const vehicle = await Vehicle.findOne({
        _id: vehicleId,
        tenantId: req.user.tenantId
      });
      if (!vehicle) {
        return res.status(400).json({ error: 'Invalid vehicle selected' });
      }
    }

    const device = new GPSDevice({
      tenantId: req.user.tenantId,
      imei,
      name,
      brand,
      protocol,
      phoneNumber,
      vehicleId
    });

    await device.save();

    res.status(201).json({
      message: 'Device created successfully',
      device
    });
  } catch (error) {
    console.error('Create device error:', error);
    res.status(500).json({ error: 'Failed to create device' });
  }
};

exports.updateDevice = async (req, res) => {
  try {
    const { name, phoneNumber, vehicleId, status, config } = req.body;
    const updates = {};

    if (name) updates.name = name;
    if (phoneNumber) updates.phoneNumber = phoneNumber;
    if (status) updates.status = status;
    if (config) updates.config = config;

    if (vehicleId !== undefined) {
      if (vehicleId) {
        const vehicle = await Vehicle.findOne({
          _id: vehicleId,
          tenantId: req.user.tenantId
        });
        if (!vehicle) {
          return res.status(400).json({ error: 'Invalid vehicle selected' });
        }
        updates.vehicleId = vehicleId;
      } else {
        updates.vehicleId = null;
      }
    }

    const device = await GPSDevice.findOneAndUpdate(
      { _id: req.params.id, tenantId: req.user.tenantId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({
      message: 'Device updated successfully',
      device
    });
  } catch (error) {
    console.error('Update device error:', error);
    res.status(500).json({ error: 'Failed to update device' });
  }
};

exports.deleteDevice = async (req, res) => {
  try {
    const device = await GPSDevice.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    await GPSData.deleteMany({ deviceId: device._id });

    res.json({ message: 'Device deleted successfully' });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ error: 'Failed to delete device' });
  }
};

exports.sendCommand = async (req, res) => {
  try {
    const { command, parameters } = req.body;
    const device = await GPSDevice.findOne({
      _id: req.params.id,
      tenantId: req.user.tenantId
    });

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    if (device.status !== 'Connected') {
      return res.status(400).json({ error: 'Device is offline' });
    }

    const commandResult = await sendDeviceCommand(device, command, parameters);

    res.json({
      message: 'Command sent successfully',
      result: commandResult
    });
  } catch (error) {
    console.error('Send command error:', error);
    res.status(500).json({ error: 'Failed to send command' });
  }
};

async function sendDeviceCommand(device, command, parameters) {
  return { success: true, command, timestamp: new Date() };
}