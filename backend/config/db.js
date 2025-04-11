require('dotenv').config();
const { Pool } = require('pg');

// Check if required environment variables are set
const requiredEnvVars = ['DB_USER', 'DB_HOST', 'DB_NAME', 'DB_PASSWORD', 'DB_PORT'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
  console.error(`Error: Missing required environment variables: ${missingEnvVars.join(', ')}`);
  process.exit(1); // Exit with error code
}

// Use test database if the environment is set to test
const databaseName = process.env.NODE_ENV === 'test' 
  ? 'fyp_rent_a_space_test' 
  : process.env.DB_NAME;

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: databaseName,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

pool.on('connect', () => {
  console.log(`Connected to database: ${databaseName}`);
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

module.exports = pool;