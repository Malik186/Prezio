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
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String },
  googleId: { type: String },
  recoveryKeyHash: {
    type: String,
    default: null,
    select: false
  },
  sessions: [sessionSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('User', userSchema);
