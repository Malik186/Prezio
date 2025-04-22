// src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication middleware to protect routes
 * Verifies the JWT token from cookies and attaches user to request object
 * Excludes only sensitive fields from the user object
 */
const protect = async (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Find user and exclude only sensitive fields (password, recovery keys, etc.)
    req.user = await User.findById(decoded.id).select('-password -recoveryKeyHash');
    
    if (!req.user) {
      return res.status(401).json({ message: 'User not found' });
    }
    
    next();
  } catch (err) {
    // Using status code 403 (Forbidden) for invalid tokens as in second implementation
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

module.exports = protect;