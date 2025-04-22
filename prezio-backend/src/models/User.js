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
  logo: { type: String }, // Cloudinary URL

}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
