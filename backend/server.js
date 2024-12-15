const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 5000;

// Import authRoutes
const authRoutes = require('./routes/authRoutes'); // Ensure the correct path to your authRoutes.js file

app.use(cors());
app.use(bodyParser.json());

// Test Route for Frontend Connection
app.get('/', (req, res) => {
    res.json({ message: 'Testing to see if works' }); // Send JSON response
});

// PostgreSQL Database Configuration
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres', 
    host: 'localhost',
    database: 'fyp_rent_a_space', // database  name from psql
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

app.use(bodyParser.json());
app.use(express.json()); // Extra safeguard for JSON

// Use authRoutes
app.use('/auth', authRoutes); // All routes in authRoutes.js will be prefixed with /auth

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
