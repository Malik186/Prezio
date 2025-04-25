// routes/twoFactorRoutes.js
const express = require('express');
const router = express.Router();
const { generate2FASecret, verify2FACode } = require('../controllers/twoFactorController');
const protect = require('../middleware/authMiddleware');

router.get('/generate', protect, generate2FASecret);
router.post('/verify', protect, verify2FACode);

module.exports = router;
