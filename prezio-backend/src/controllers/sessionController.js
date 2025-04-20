// src/controllers/sessionController.js
const User = require('../models/User');

exports.getSessions = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('sessions');
    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ sessions: user.sessions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.terminateSession = async (req, res) => {
  const { sessionId } = req.params;

  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const sessionIndex = user.sessions.findIndex(s => s.sessionId === sessionId);
    if (sessionIndex === -1) return res.status(404).json({ message: 'Session not found' });

    user.sessions.splice(sessionIndex, 1);
    await user.save();

    res.json({ message: 'Session terminated successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
