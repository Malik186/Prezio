// models/CustomItemType.js
const mongoose = require('mongoose');

const customItemTypeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

customItemTypeSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('CustomItemType', customItemTypeSchema);
