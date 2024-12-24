const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const authenticateToken = require('./middleware/authenticateToken'); // Import the authenticate middleware
const authRoutes = require('./routes/authRoutes'); // Auth routes
const profileRoutes = require('./routes/profileRoutes'); // Profile routes

// Initialize the app
const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.json()); // Extra safeguard for JSON

// Test Route for Frontend Connection
app.get('/', (req, res) => {
    res.json({ message: 'Testing to see if works' }); // Send JSON response
});

// PostgreSQL Database Configuration
const { Pool } = require('pg');
const pool = new Pool({
    user: 'postgres',
    host: 'localhost',
    database: 'fyp_rent_a_space', // database name from psql
    password: 'kingace999', // psql password
    port: 5432,
});

// Test Database Connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Error connecting to the database:', err);
    } else {
        console.log('Database connected:', res.rows);
    }
});

// Routes
app.use('/auth', authRoutes); // Auth-related routes
app.use('/profile', authenticateToken, profileRoutes); // Profile-related routes

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
