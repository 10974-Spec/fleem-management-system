const mongoose = require('mongoose');

const gpsDataSchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'GPSDevice',
    required: true,
    index: true
  },
  vehicleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Vehicle',
    index: true
  },
  lat: {
    type: Number,
    required: true
  },
  lng: {
    type: Number,
    required: true
  },
  speed: {
    type: Number,
    default: 0
  },
  heading: {
    type: Number
  },
  altitude: {
    type: Number
  },
  ignition: {
    type: Boolean,
    default: false
  },
  fuelLevel: {
    type: Number
  },
  batteryLevel: {
    type: Number
  },
  odometer: {
    type: Number
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  accuracy: {
    type: Number
  },
  rawData: {
    type: String
  }
}, {
  timestamps: true
});

gpsDataSchema.index({ deviceId: 1, timestamp: -1 });
gpsDataSchema.index({ vehicleId: 1, timestamp: -1 });

module.exports = mongoose.model('GPSData', gpsDataSchema);