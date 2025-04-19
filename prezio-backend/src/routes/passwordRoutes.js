// src/routes/passwordRoutes.js
const express = require('express');
const router = express.Router();
const { forgotPassword, verifyCode } = require('../controllers/passwordController');

router.post('/forgot-password', forgotPassword);
router.post('/verify-code', verifyCode);

module.exports = router;
// This code defines the routes for password reset functionality in an Express application. It imports the necessary modules, sets up the router, and defines two POST routes: one for requesting a password reset code and another for verifying that code. The routes are then exported for use in the main application file.
// The forgotPassword route handles the request to send a password reset code to the user's email, while the verifyCode route checks if the provided code is valid and not expired. The routes are linked to their respective controller functions for handling the logic.