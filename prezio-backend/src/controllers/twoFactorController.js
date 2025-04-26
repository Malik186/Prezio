// src/controllers/twoFactorController.js
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const User = require('../models/User');

exports.generate2FASecret = async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `Prezio (${req.user.email})`
    });

    const user = await User.findById(req.user._id);
    user.twoFactorTempSecret = secret.base32;
    await user.save();

    const otpauthUrl = secret.otpauth_url;

    qrcode.toDataURL(otpauthUrl, (err, data_url) => {
      if (err) {
        return res.status(500).json({ message: 'Error generating QR code' });
      }

      res.status(200).json({
        qrCode: data_url,
        manualEntryKey: secret.base32
      });
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.verify2FACode = async (req, res) => {
    const { token } = req.body;
    const sessionData = req.session?.pending2FA;
  
    try {
      // For login: sessionData exists
      if (sessionData) {
        const user = await User.findById(sessionData.userId);
        if (!user || !user.twoFactorSecret) {
          return res.status(400).json({ message: '2FA not set up' });
        }
  
        const verified = speakeasy.totp.verify({
          secret: user.twoFactorSecret,
          encoding: 'base32',
          token
        });
  
        if (!verified) {
          return res.status(401).json({ message: 'Invalid 2FA code' });
        }
  
        // Login continues here
        const sessionId = crypto.randomUUID();
        const newSession = {
          sessionId,
          ip: sessionData.ip,
          device: sessionData.device,
          createdAt: new Date()
        };
  
        user.sessions.push(newSession);
        await user.save();
  
        const jwtToken = generateToken(user._id);
        res.cookie('token', jwtToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
        });
  
        delete req.session.pending2FA;
  
        res.status(200).json({ user, token: jwtToken });
      } else {
        // 2FA setup: permanent save of the secret
        const user = await User.findById(req.user._id);
  
        const verified = speakeasy.totp.verify({
          secret: user.twoFactorTempSecret,
          encoding: 'base32',
          token
        });
  
        if (!verified) {
          return res.status(401).json({ message: 'Invalid verification code' });
        }
  
        user.twoFactorSecret = user.twoFactorTempSecret;
        user.twoFactorTempSecret = undefined;
        user.twoFactorEnabled = true;
        await user.save();
  
        res.status(200).json({ message: '2FA enabled successfully' });
      }
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: '2FA verification failed' });
    }
  };

  exports.disable2FA = async (req, res) => {
    const { password } = req.body;
  
    try {
      const user = await User.findById(req.user._id);
  
      if (!user.twoFactorEnabled) {
        return res.status(400).json({ message: '2FA is not enabled' });
      }
  
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({ message: 'Incorrect password' });
      }
  
      user.twoFactorEnabled = false;
      user.twoFactorSecret = undefined;
      user.twoFactorTempSecret = undefined;
      await user.save();
  
      res.status(200).json({ message: '2FA has been disabled successfully' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Failed to disable 2FA' });
    }
  };
  
  