const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  clientName: {
    type: String,
    required: true
  },
  clientAddress: {
    type: String,
    required: true
  },
  contactPersonName: {
    type: String,
    required: true
  },
  contactPersonPhone: {
    type: String,
    required: true
  },
  contactPersonEmail: {
    type: String,
    required: true
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Client', clientSchema);
