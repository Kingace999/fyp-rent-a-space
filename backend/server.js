require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const authenticateToken = require('./middleware/authenticateToken');
const authRoutes = require('./routes/authRoutes');
const profileRoutes = require('./routes/profileRoutes');
const listingsRoutes = require('./routes/listingsRoutes');
const bookingRoutes = require('./routes/bookingsRoutes');
const reviewsRoutes = require('./routes/reviewsRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const notificationsRoutes = require('./routes/notificationRoutes');
const messagesRoutes = require('./routes/messagesRoutes');
const vision = require('@google-cloud/vision');
const spaceAnalysisRoutes = require('./routes/spaceAnalysisRoutes');
const pool = require('./config/db');

const client = new vision.ImageAnnotatorClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const app = express();
const PORT = process.env.PORT || 5000;

// ======== MANUAL CORS HANDLING (BEFORE ANY MIDDLEWARE) ========
// This explicitly handles all CORS requests including preflight
app.use((req, res, next) => {
  // Allow the specific origin
  const allowedOrigin = process.env.CLIENT_URL || 'https://fyp-rent-a-space.vercel.app';
  
  // Set CORS headers for all responses
  res.header('Access-Control-Allow-Origin', allowedOrigin);
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  // Handle preflight
  if (req.method === 'OPTIONS') {
    console.log(`[${new Date().toISOString()}] Handling OPTIONS preflight request from ${req.headers.origin}`);
    return res.status(200).send();
  }
  
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} from ${req.headers.origin || 'unknown origin'}`);
  next();
});

// Built-in CORS middleware as backup
app.use(cors({
  origin: process.env.CLIENT_URL || 'https://fyp-rent-a-space.vercel.app',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

console.log('CORS middleware registered with permissive settings');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Cookie parser early to handle cookie-based auth
app.use(cookieParser());

// Capture responses to log headers
app.use((req, res, next) => {
  const originalSend = res.send;
  res.send = function(...args) {
    console.log(`Response headers for ${req.method} ${req.url}:`, JSON.stringify(res.getHeaders()));
    return originalSend.apply(res, args);
  };
  next();
});

// Parse normal JSON for all routes except /payments/webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/payments/webhook') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

app.use(bodyParser.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Test route
app.get('/', (req, res) => {
  res.json({ 
    message: 'API is running',
    cors: 'CORS configured for: ' + (process.env.CLIENT_URL || 'https://fyp-rent-a-space.vercel.app')
  });
});

// Test CORS route
app.get('/test-cors', (req, res) => {
  res.json({
    message: 'CORS test successful',
    received_origin: req.headers.origin || 'No origin header',
    time: new Date().toISOString()
  });
});

// Test DB connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Error connecting to the database:', err);
  } else {
    console.log('Database connection successful');
  }
});

// Routes
app.use('/auth', authRoutes);
app.use('/profile', authenticateToken, profileRoutes);
app.use('/listings', listingsRoutes);
app.use('/bookings', bookingRoutes);
app.use('/reviews', reviewsRoutes);
app.use('/payments', paymentRoutes);
app.use('/notifications', authenticateToken, notificationsRoutes);
app.use('/messages', authenticateToken, messagesRoutes);
app.use('/space-analysis', spaceAnalysisRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ status: 'error', message: 'Server error' });
});

// Start server if run directly
if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`CORS configured for: ${process.env.CLIENT_URL || 'https://fyp-rent-a-space.vercel.app'}`);
  });

  app.close = () => {
    server.close();
  };
}

module.exports = app;