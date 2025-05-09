// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const { register, login, logout, getProfile, updateProfile } = require('../controllers/authController');
const { changePassword } = require('../controllers/authController');
const { regenerateAccessKey } = require('../controllers/authController');
const authController = require('../controllers/authController');
const auth = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadLogo');
const { getSessions, terminateSession } = require('../controllers/sessionController');
const { terminateAccount } = require('../controllers/authController');
const { abortTermination } = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.get('/logout', logout);
router.get('/me', auth, getProfile);
router.patch('/me', auth, updateProfile);
router.patch('/change-password', auth, changePassword);
router.post('/regenerate-access-key', auth, regenerateAccessKey);
router.post('/me/logo', auth, upload.single('logo'), authController.uploadLogo);
router.delete('/me/logo', auth, authController.deleteLogo);
router.get('/sessions', auth, getSessions);
router.delete('/sessions/:sessionId', auth, terminateSession);
router.post('/terminate', auth, terminateAccount);
router.post('/abort-termination', auth, abortTermination);

module.exports = router;
