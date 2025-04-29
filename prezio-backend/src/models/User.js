const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  ip: String,
  device: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const userSchema = new mongoose.Schema({
  // Basic auth fields
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  googleId: { type: String },

  // Recovery Key
  recoveryKeyHash: {
    type: String,
    default: null,
    select: false
  },

  // Sessions
  sessions: [sessionSchema],

  // Extended profile fields
  firstName: { type: String },
  middleName: { type: String },
  surname: { type: String },
  companyName: { type: String },
  phone: { type: String },
  address: { type: String },

  // Logo
  logo: {
    url: { type: String },
    public_id: { type: String }
  },

  // last quotation number
  lastQuoteNumber: {
    type: Number,
    default: 0
  },  

  // Role (admin/user)
  role: {
    type: String,
    enum: ['admin', 'user'],
    default: 'user'
  },

  // Two-Factor Authentication
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  twoFactorSecret: {
    type: String,
    select: false // prevent exposing it
  },
  twoFactorTempSecret: { type: String },


  // Account Termination
  // This is a soft delete, the user will be marked as terminated but not removed from the database
  terminationRequested: {
    type: Boolean,
    default: false
  },
  terminationDate: {
    type: Date,
    default: null
  }


}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
