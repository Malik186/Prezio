const User = require('../models/User');
const bcrypt = require('bcryptjs');
const generateToken = require('../utils/generateToken');
const sendEmail = require('../utils/sendEmail');
const generateRecoveryKey = require('../utils/generateRecoveryKey');
const generateRecoveryPDF = require('../utils/generateRecoveryPDF');
const { cloudinary } = require('../config/cloudinary');
const path = require('path');
const fs = require('fs');
const getDeviceDetails = require('../utils/getDeviceDetails');
const crypto = require('crypto');
const DEFAULT_LOGOS = [
  'https://res.cloudinary.com/dqmo5qzze/image/upload/v1745409948/default-logo-1_al7thz.png',
  'https://res.cloudinary.com/dqmo5qzze/image/upload/v1745409948/default-logo-2_kaywcs.png',
  'https://res.cloudinary.com/dqmo5qzze/image/upload/v1745409947/default-logo-3_mbvp1t.png',
  'https://res.cloudinary.com/dqmo5qzze/image/upload/v1745409947/default-logo-4_ug6isl.png'
];

exports.register = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 12);

    // Determine role
    const role = email === 'ianmathew186@gmail.com' ? 'admin' : 'user';

    // Random logo assignment
    const randomLogo = DEFAULT_LOGOS[Math.floor(Math.random() * DEFAULT_LOGOS.length)];

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role,
      logo: {
        url: randomLogo,
        public_id: null // No public_id since it's a static default
      }
    });

    const plainKey = generateRecoveryKey();
    const hashedKey = await bcrypt.hash(plainKey, 12);
    user.recoveryKeyHash = hashedKey;
    await user.save();

    const pdfPath = await generateRecoveryPDF({ name, email, recoveryKey: plainKey });
    const pdfFilename = path.basename(pdfPath);

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
      recoveryKey: plainKey,
      recoveryPdfPath: `/recovery/${pdfFilename}`,
      message: 'Registration successful! A recovery PDF has been generated.'
    });

    setTimeout(() => {
      fs.unlink(pdfPath, (err) => {
        if (err) console.error('Error deleting temporary PDF:', err);
      });
    }, 5 * 60 * 1000);

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

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password -recoveryKeyHash -__v');

    if (!user) return res.status(404).json({ message: 'User not found' });

    const profile = {
      ...user.toObject(),
      lastUpdated: user.updatedAt,
    };

    res.status(200).json({ user: profile });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
};

exports.updateProfile = async (req, res) => {
  const updates = {};
  const allowedFields = [
    'firstName',
    'middleName',
    'surname',
    'companyName',
    'phone',
    'address'
  ];

  allowedFields.forEach(field => {
    if (req.body[field]) updates[field] = req.body[field];
  });

  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -recoveryKeyHash');

    res.status(200).json({ message: 'Profile updated', user: updatedUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to update profile' });
  }
};

exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword)
    return res.status(400).json({ message: 'Both fields are required' });

  try {
    const user = await User.findById(req.user._id).select('+password');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(401).json({ message: 'Incorrect current password' });

    const hashedNewPassword = await bcrypt.hash(newPassword, 12);
    user.password = hashedNewPassword;
    await user.save();

    res.status(200).json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Failed to change password' });
  }
};

exports.regenerateAccessKey = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) return res.status(404).json({ message: 'User not found' });

    const plainKey = generateRecoveryKey();
    const hashedKey = await bcrypt.hash(plainKey, 12);

    user.recoveryKeyHash = hashedKey;
    await user.save();

    const pdfPath = await generateRecoveryPDF({
      name: user.name,
      email: user.email,
      recoveryKey: plainKey
    });

    const filename = path.basename(pdfPath);

    // Auto delete PDF after 5 mins
    setTimeout(() => {
      fs.unlink(pdfPath, (err) => {
        if (err) console.error('Failed to delete recovery PDF:', err);
      });
    }, 5 * 60 * 1000);

    res.status(200).json({
      message: 'New recovery key generated!',
      recoveryKey: plainKey,
      downloadLink: `/recovery/${filename}`
    });

  } catch (err) {
    console.error('Access key regeneration failed:', err);
    res.status(500).json({ message: 'Server error while regenerating access key' });
  }
};

exports.uploadLogo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!req.file || !req.file.path || !req.file.filename)
      return res.status(400).json({ message: 'No logo uploaded' });

    // Optional: delete previous logo
    if (user.logo?.public_id) {
      await cloudinary.uploader.destroy(user.logo.public_id);
    }

    user.logo = {
      url: req.file.path, // Cloudinary secure URL
      public_id: req.file.filename, // public_id from multer-storage-cloudinary
    };
    await user.save();

    res.status(200).json({
      message: 'Logo uploaded successfully',
      logo: user.logo,
    });
  } catch (err) {
    console.error('Upload logo failed:', err);
    res.status(500).json({ message: 'Failed to upload logo' });
  }
};

exports.deleteLogo = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.logo?.public_id) {
      return res.status(404).json({ message: 'No logo to Remove' });
    }

    await cloudinary.uploader.destroy(user.logo.public_id);

    user.logo = undefined;
    await user.save();

    res.status(200).json({ message: 'Logo Removed successfully' });
  } catch (err) {
    console.error('Failed to Remove logo:', err);
    res.status(500).json({ message: 'Could not delete logo' });
  }
};

exports.terminateAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid password' });

    user.terminationRequested = true;
    user.terminationDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
    await user.save();

    res.status(200).json({
      message: 'Account termination scheduled. Your account will be deleted in 7 days.',
      terminationDate: user.terminationDate
    });
  } catch (err) {
    console.error('Account termination error:', err);
    res.status(500).json({ message: 'Server error during termination' });
  }
};

exports.abortTermination = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.terminationRequested || !user.terminationDate) {
      return res.status(400).json({ message: 'No termination was scheduled for this account' });
    }

    user.terminationRequested = false;
    user.terminationDate = undefined;
    await user.save();

    res.status(200).json({ message: 'Account termination cancelled successfully' });
  } catch (err) {
    console.error('Abort termination error:', err);
    res.status(500).json({ message: 'Server error while aborting termination' });
  }
};


exports.logout = (req, res) => {
  res.clearCookie('token');
  res.status(200).json({ message: 'Logged out successfully' });
};
