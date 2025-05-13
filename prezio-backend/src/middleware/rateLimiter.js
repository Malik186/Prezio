const rateLimit = require('express-rate-limit');

const invoiceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    error: '❌ Too many requests from this IP, please try again after 15 minutes',
    retryAfter: '15 minutes'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Store to track request counts by IP
  store: new rateLimit.MemoryStore(),
  // Skip rate limiting for trusted IPs (optional)
  skip: (req) => {
    const trustedIPs = process.env.TRUSTED_IPS ? process.env.TRUSTED_IPS.split(',') : [];
    return trustedIPs.includes(req.ip);
  }
});

// Stricter limiter for sensitive operations
const sensitiveOpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // Limit each IP to 50 requests per hour
  message: {
    error: '❌ Too many sensitive operations from this IP, please try again after an hour',
    retryAfter: '60 minutes'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new rateLimit.MemoryStore()
});

module.exports = {
  invoiceLimiter,
  sensitiveOpLimiter
};