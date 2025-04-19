// src/controllers/authController.js
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail'); // ✅ Import SendGrid utility
const generateRecoveryKey = require('../utils/generateRecoveryKey');

exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashedPassword });

    // Generate recovery key
    const plainKey = generateRecoveryKey();
    const hashedKey = await bcrypt.hash(plainKey, 12);
    user.recoveryKeyHash = hashedKey;
    await user.save();

    // ✅ Send welcome email with recovery key
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

    res.status(201).json({
      user,
      token,
      recoveryKey: plainKey, // show once
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user || !user.password)
      return res.status(401).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ message: 'Invalid credentials' });

    const token = generateToken(user._id);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
    });

    res.status(200).json({ user, token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
};