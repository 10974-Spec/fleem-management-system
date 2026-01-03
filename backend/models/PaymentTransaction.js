const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema({
  tenantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Tenant',
    required: true
  },
  subscriptionPlan: {
    type: String,
    enum: ['Free', 'Premium'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'USD'
  },
  paymentMethod: {
    type: String,
    enum: ['Mpesa', 'Card', 'BankTransfer'],
    default: 'Mpesa'
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Cancelled'],
    default: 'Pending'
  },
  mpesaReference: {
    type: String
  },
  transactionId: {
    type: String
  },
  phoneNumber: {
    type: String
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  completedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);