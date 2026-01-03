const mongoose = require('mongoose');

const deviceSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle'
  },
  imei: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String
  },
  brand: {
    type: String,
    enum: ['Teltonika', 'Concox', 'Queclink', 'Meitrack', 'Custom', 'Other'],
    required: true
  },
  protocol: {
    type: String
  },
  phoneNumber: {
    type: String
  },
  status: {
    type: String,
    enum: ['Connected', 'Offline', 'Disabled'],
    default: 'Offline'
  },
  lastSeen: {
    type: Date
  },
  config: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('GPSDevice', deviceSchema);