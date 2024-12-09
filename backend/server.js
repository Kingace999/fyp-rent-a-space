const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// Test Route for Frontend Connection
app.get('/', (req, res) => {
    res.json({ message: 'Backend is running!' }); // Send JSON response
});

// PostgreSQL Database Configuration
const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres', // Replace with your PostgreSQL username
    host: 'localhost',
    database: 'fyp_rent_a_space', // Replace with your database name
    password: 'kingace999', // Replace with your PostgreSQL password
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

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
}); // new check backend
