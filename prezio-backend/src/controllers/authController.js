const User = require('../models/User');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const generateRecoveryKey = require('../utils/generateRecoveryKey');
const getDeviceDetails = require('../utils/getDeviceDetails');
const crypto = require('crypto');

exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashedPassword });

    const plainKey = generateRecoveryKey();
    const hashedKey = await bcrypt.hash(plainKey, 12);
    user.recoveryKeyHash = hashedKey;
    await user.save();

    await sendEmail({
      to: user.email,
      subject: 'Welcome to Prezio!',
      html: `<p>Hello <strong>${user.name}</strong>, welcome to Prezio 🎉</p>
             <p><strong>Your recovery key (keep it safe!):</strong><br>${plainKey}</p>`
    });

    const token = generateToken(user._id);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });

    res.status(201).json({ user, token, recoveryKey: plainKey });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  const userAgent = req.headers['user-agent'];
  const deviceInfo = getDeviceDetails(userAgent);
  const deviceString = deviceInfo.full;

  try {
    const user = await User.findOne({ email });
    if (!user || !user.password)
      return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const sessionId = crypto.randomUUID();
    const deviceString = `${deviceInfo.browser} on ${deviceInfo.os}`;

    // Match field names with your schema
    const newSession = {
      sessionId,
      ip,
      device: deviceString,
      createdAt: new Date()
    };

    const isNewDevice = !user.sessions.some(
      s => s.ip === ip && s.device === deviceString
    );

    user.sessions.push(newSession);
    await user.save();

    if (isNewDevice) {
      await sendEmail({
        to: user.email,
        subject: '🔐 New Login Detected',
        html: `<p>Hello ${user.name},</p>
              <p>A new login to your account was detected:</p>
              <ul>
                <li><strong>IP:</strong> ${ip}</li>
                <li><strong>Device:</strong> ${deviceString}</li>
                <li><strong>Time:</strong> ${new Date().toLocaleString()}</li>
              </ul>
              <p>If this wasn't you, please log in and terminate the session immediately.</p>`
      });
    }

    const token = generateToken(user._id);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });

    res.status(200).json({ user, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
};
