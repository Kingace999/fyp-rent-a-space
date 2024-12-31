const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',            // Update with your database user
    host: 'localhost',           // Update with your database host
    database: 'fyp_rent_a_space', // Update with your database name
    password: 'kingace999',       // Update with your database password
    port: 5432,                  // Default PostgreSQL port
});

pool.on('connect', () => {
    console.log('Connected to the database');
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

module.exports = pool;
