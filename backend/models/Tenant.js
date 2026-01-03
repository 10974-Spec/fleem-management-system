const mongoose = require('mongoose');

const tenantSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  plan: {
    type: String,
    enum: ['Free', 'Premium'],
    default: 'Free'
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Suspended'],
    default: 'Active'
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  vehicleLimit: {
    type: Number,
    default: 5
  },
  currentVehicleCount: {
    type: Number,
    default: 0
  },
  subscriptionEndsAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Tenant', tenantSchema);