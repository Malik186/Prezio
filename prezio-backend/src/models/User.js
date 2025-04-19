// src/models/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  googleId: { type: String },
  recoveryKeyHash: {
    type: String,
    default: null,
    select: false, // never return in queries
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);