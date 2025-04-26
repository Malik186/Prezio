// src/routes/twoFactorRoutes.js
const express = require('express');
const router = express.Router();
const { generate2FASecret, verify2FACode, disable2FA } = require('../controllers/twoFactorController');
const protect = require('../middleware/authMiddleware');

// Setup flow
router.get('/generate', protect, generate2FASecret);
router.post('/verify', protect, verify2FACode);

//Disable 2FA
router.post('/disable', protect, disable2FA);

module.exports = router;
