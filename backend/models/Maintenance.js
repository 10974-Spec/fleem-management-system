const mongoose = require('mongoose');

const maintenanceSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    required: true
  },
  type: {
    type: String,
    enum: ['OilChange', 'TireRotation', 'BrakeService', 'EngineRepair', 'BatteryReplacement', 'General', 'Other'],
    required: true
  },
  description: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    required: true
  },
  nextDueDate: {
    type: Date
  },
  odometerAtService: {
    type: Number
  },
  cost: {
    type: Number,
    min: 0
  },
  serviceProvider: {
    type: String
  },
  notes: {
    type: String
  },
  attachments: [{
    url: String,
    name: String
  }],
  completedBy: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Maintenance', maintenanceSchema);