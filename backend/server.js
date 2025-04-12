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

// Initialize the app
const app = express();
const PORT = process.env.PORT || 5000;

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware for Stripe webhooks
app.use(
    '/payments/webhook',
    express.raw({ type: 'application/json' })
);

// General Middleware
app.use(cors({
    origin: 'https://fyp-rent-a-space.vercel.app',
    credentials: true
  }));
  
  

app.use(bodyParser.json());
app.use(express.json());
app.use(cookieParser());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Test Route for Frontend Connection
app.get('/', (req, res) => {
    res.json({ message: 'Testing to see if works' });
});

// Test Database Connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error connecting to the database:', err);
    } else {

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

// Only start the server if this file is run directly (not required by tests)
if (require.main === module) {
    const server = app.listen(PORT, () => {


    });
    
    app.close = () => {
        server.close();
    };
}

// Export the app for testing
module.exports = app;