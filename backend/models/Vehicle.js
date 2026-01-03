const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  plateNumber: {
    type: String,
    required: true,
    unique: true
  },
  vin: {
    type: String
  },
  vehicleType: {
    type: String,
    enum: ['Truck', 'Van', 'Car', 'Bus', 'Motorcycle', 'Other'],
    default: 'Other'
  },
  fuelType: {
    type: String,
    enum: ['Petrol', 'Diesel', 'Electric', 'Hybrid', 'CNG'],
    default: 'Petrol'
  },
  year: {
    type: Number
  },
  make: {
    type: String
  },
  model: {
    type: String
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Maintenance', 'Retired'],
    default: 'Active'
  },
  currentDriver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  currentLocation: {
    lat: Number,
    lng: Number,
    lastUpdated: Date
  },
  fuelCapacity: {
    type: Number
  },
  odometer: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Vehicle', vehicleSchema);