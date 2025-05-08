// src/app.js
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');
const passwordRoutes = require('./routes/passwordRoutes');
const { recoveryLogin } = require('./controllers/passwordController');
const recoveryRoutes = require('./routes/recoveryRoutes');
const securityRoutes = require('./routes/securityRoutes');
const twoFactorRoutes = require('./routes/twoFactorRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const clientRoutes = require('./routes/clientRoutes');
const quotationRoutes = require('./routes/quotationRoutes');
const invoiceRoutes = require('./routes/invoiceRoutes');

const adminRoutes = require('./routes/adminRoutes');

const app = express();
// Update your backend CORS configuration
app.use(cors({
  origin: '*',  // Allow requests from any origin
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Default route
app.get('/', (req, res) => {
  res.send('Backend is running...');
});

// Auth route
app.use('/api/auth', authRoutes);

// Password reset routes
app.use('/api/password', passwordRoutes);

// Recovery login route - create a route directly on app
app.post('/api/recovery-login', recoveryLogin);

// Recovery PDF route - serve the PDF from the temp folder
app.use('/recovery', recoveryRoutes);

// Security routes

app.use('/api/security', securityRoutes);

// Two-factor authentication routes
app.use('/api/two-factor', twoFactorRoutes);

// Notification routes
app.use('/api/notifications', notificationRoutes);

// Client routes
app.use('/api/clients', clientRoutes);

// Quotation routes
app.use('/api/quotations', quotationRoutes);

// Invoice routes
app.use('/api/invoices', invoiceRoutes);

/**
 * Admin-only Routes
 * Checks if the authenticated user has admin role
 * Goes after the protect middleware
 */

// Admin routes
app.use('/api/admin', adminRoutes);

module.exports = app;