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

const app = express();
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());
app.use(cookieParser());

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

module.exports = app;