// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, login, logout, getProfile, updateProfile } = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');
const { getSessions, terminateSession } = require('../controllers/sessionController');

router.post('/register', register);
router.post('/login', login);
router.get('/logout', logout);
router.get('/me', auth, getProfile);
router.patch('/me', auth, updateProfile);
router.get('/sessions', auth, getSessions);
router.delete('/sessions/:sessionId', auth, terminateSession);

module.exports = router;
