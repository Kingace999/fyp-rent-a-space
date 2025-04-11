// middleware/securityMiddleware.js
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    status: 'error',
    message: 'Too many requests from this IP, please try again after 15 minutes',
  }
});

// Specific rate limiter for authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 auth attempts per windowMs
  message: {
    status: 'error',
    message: 'Too many authentication attempts, please try again after 15 minutes',
  }
});

// Configure security middleware
const setupSecurityMiddleware = (app) => {
  // Set security headers using Helmet
  app.use(helmet());
  
  // Prevent XSS attacks
  app.use(xss());
  
  // Apply rate limiting to all requests
  app.use('/api', apiLimiter);
  
  // Apply stricter rate limiting to auth routes
  app.use('/auth', authLimiter);
};

module.exports = {
  setupSecurityMiddleware,
  authLimiter
};