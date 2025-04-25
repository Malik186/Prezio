const SecurityLog = require('../models/SecurityLog');

// Create a new log
exports.logSecurityEvent = async ({ userId, action, details = '', ip, device }) => {
  try {
    await SecurityLog.create({ user: userId, action, details, ip, device });
  } catch (err) {
    console.error('Failed to log security event:', err.message);
  }
};

// Fetch logs for a user
exports.getUserSecurityLogs = async (req, res) => {
  try {
    const logs = await SecurityLog.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);

    res.status(200).json({ logs });
  } catch (err) {
    console.error('Error fetching logs:', err.message);
    res.status(500).json({ message: 'Failed to fetch logs' });
  }
};
