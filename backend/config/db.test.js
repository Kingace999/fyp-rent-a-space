// config/db.test.js
require('dotenv').config(); // Use your existing .env file
const { Pool } = require('pg');

// Create a pool that's identical to  regular one except for the database name
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: 'fyp_rent_a_space_test', // Hardcode the test database name
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.on('connect', () => {
  console.log('Connected to the test database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on test database client', err);
  process.exit(-1);
});

module.exports = pool;