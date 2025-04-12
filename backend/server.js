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

// Vision API client with environment variable support
let client;
try {
  if (process.env.GOOGLE_CREDENTIALS) {
    // Use credentials from environment variable
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS);
    client = new vision.ImageAnnotatorClient({ credentials });
    console.log("Successfully initialized Vision API with credentials from environment variable");
  } else {
    // Fall back to file-based credentials
    client = new vision.ImageAnnotatorClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
    console.log("Successfully initialized Vision API with credentials from file");
  }
} catch (error) {
  console.error("Failed to initialize Google Vision API client:", error);
  client = null;
}

const app = express();
const PORT = process.env.PORT || 8080;

// CORS comes first
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'https://fyp-rent-a-space.vercel.app',
    credentials: true,
  })
);

console.log('CORS middleware has been registered');

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Parse normal JSON for all routes except /payments/webhook
app.use((req, res, next) => {
  if (req.originalUrl === '/payments/webhook') {
    express.raw({ type: 'application/json' })(req, res, next);
  } else {
    express.json()(req, res, next);
  }
});

app.use(bodyParser.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Testing to see if works' });
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

// Start server if run directly
if (require.main === module) {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT} binding to all interfaces`);
  });

  app.close = () => {
    server.close();
  };
}

module.exports = app;