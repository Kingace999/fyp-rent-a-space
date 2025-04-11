// e2e-tests/helpers/dbSetup.js
const path = require('path');
const dotenv = require('dotenv');

// Load from the specific file path to avoid conflicts with other .env files
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { Pool } = require('pg');
const bcrypt = require('bcrypt');

// Create a pool specifically for e2e testing
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT
});

/**
 * Verifies the current database connection
 * @returns {Promise<string>} Current database name
 */
async function verifyDatabaseConnection() {
  const client = await pool.connect();
  try {
    const dbResult = await client.query('SELECT current_database()');
    const currentDatabase = dbResult.rows[0].current_database;
    console.log(' CURRENT DATABASE:', currentDatabase);
    
    try {
      // Additional verification checks
      const userCountResult = await client.query('SELECT COUNT(*) FROM users');
      console.log(' Initial User Count:', userCountResult.rows[0].count);
    } catch (err) {
      console.log('Could not count users - table may not exist yet');
    }
    
    return currentDatabase;
  } finally {
    client.release();
  }
}

/**
 * Sets up the test database with necessary data for E2E tests
 * @returns {Promise<Object>} Test data including user and listing
 */
async function setupTestDatabase() {
  try {
    // Verify database connection before proceeding
    const currentDatabase = await verifyDatabaseConnection();
    
    // Ensure we're using the test database
    if (!currentDatabase.includes('test')) {
      throw new Error(`CRITICAL: Not using a test database! Current DB: ${currentDatabase}`);
    }
    
    console.log(' Database Credentials:', {
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    
    console.log('Connected to the test database');
    
    const client = await pool.connect();
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Check if tables exist
      const tablesExist = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      
      if (!tablesExist.rows[0].exists) {
        console.log('Tables do not exist. Please run init-test-db.js first!');
        throw new Error('Test database tables not found');
      }
      
      // Clear existing test data - UPDATED with better error handling
      try {
        // Check which tables exist before trying to truncate them
        const tableExistsQuery = async (tableName) => {
          const result = await client.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = $1
            )
          `, [tableName]);
          return result.rows[0].exists;
        };

        // Check tables one by one
        const [paymentsExist, reviewsExist, bookingsExist, messagesExist, listingsExist] = 
          await Promise.all([
            tableExistsQuery('payments'),
            tableExistsQuery('reviews'),
            tableExistsQuery('bookings'),
            tableExistsQuery('messages'),
            tableExistsQuery('listings')
          ]);

        // Truncate tables that exist, in the right order
        if (reviewsExist) {
          await client.query('TRUNCATE reviews CASCADE');
          console.log('Truncated reviews table');
        }
        
        if (paymentsExist) {
          await client.query('TRUNCATE payments CASCADE');
          console.log('Truncated payments table');
        }
        
        if (bookingsExist && messagesExist) {
          await client.query('TRUNCATE bookings, messages CASCADE');
          console.log('Truncated bookings and messages tables');
        } else {
          if (bookingsExist) {
            await client.query('TRUNCATE bookings CASCADE');
            console.log('Truncated bookings table');
          }
          if (messagesExist) {
            await client.query('TRUNCATE messages CASCADE');
            console.log('Truncated messages table');
          }
        }
        
        if (listingsExist) {
          await client.query('TRUNCATE listings CASCADE');
          console.log('Truncated listings table');
        }
        
        await client.query('DELETE FROM users');
        console.log('Deleted users');
      } catch (err) {
        console.log('Error clearing tables:', err.message);
        // Don't throw error here, just continue
      }
      
      // Create a test user for e2e tests
      const hashedPassword = await bcrypt.hash('TestPassword123!', 10);
      const userResult = await client.query(
        'INSERT INTO users (name, email, password, created_at) VALUES ($1, $2, $3, $4) RETURNING *',
        ['Test User', 'test@example.com', hashedPassword, new Date()]
      );
      const user = userResult.rows[0];
      console.log(' Test user created:', user.email);
      
      // Check the actual column names in the listings table
      try {
        const columns = await client.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_name = 'listings'
        `);
        console.log('Available columns in listings table:', columns.rows.map(r => r.column_name));
        
        // Create a test listing using the correct schema
        const today = new Date();
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        
        // UPDATED: Added available_start_time and available_end_time to the listing creation
        const listingResult = await client.query(
          `INSERT INTO listings (
            user_id, title, description, type, price, price_type,
            capacity, location, latitude, longitude, 
            start_date, end_date, created_at, is_verified,
            available_start_time, available_end_time
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16) RETURNING *`,
          [
            user.id,
            'Test Space',
            'A test space for e2e testing',
            'Office Space',
            50.00,
            'hour',
            10,
            '123 Test St, Test City',
            51.5074,
            -0.1278,
            today,
            nextMonth,
            today,
            true,  // Changed to true so it appears in dashboard
            '09:00:00',  // Available start time - 9 AM
            '17:00:00'   // Available end time - 5 PM
          ]
        );
        const listing = listingResult.rows[0];
        console.log('Test listing created:', listing.title);
      } catch (err) {
        console.error('Error creating test listing:', err.message);
        // Continue without failing the whole setup
      }
      
      await client.query('COMMIT');
      
      return { 
        user,
        credentials: {
          email: user.email,
          password: 'TestPassword123!'
        }
      };
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error setting up test data:', error);
      
      // Return mock data if setup fails
      return {
        user: { id: 999, email: 'test@example.com' },
        credentials: {
          email: 'test@example.com',
          password: 'TestPassword123!'
        }
      };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Critical Error setting up test database:', {
      message: error.message,
      stack: error.stack
    });
    
    // Return mock data
    return {
      user: { id: 999, email: 'test@example.com' },
      credentials: {
        email: 'test@example.com',
        password: 'TestPassword123!'
      }
    };
  }
}

/**
 * Creates a test booking with payment for payment-related E2E tests
 * @param {Object} userId - User ID to create the booking for
 * @param {Object} listingId - Listing ID to create the booking for
 * @returns {Promise<Object>} Test booking and payment data
 */
async function setupTestPayment(userId, listingId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Create future dates for booking
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 14); // 2 weeks in the future
    
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 2); // 2-day booking
    
    // Create test booking
    const bookingResult = await client.query(
      `INSERT INTO bookings 
       (user_id, listing_id, booking_start, booking_end, total_price, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        userId,
        listingId,
        startDate,
        endDate,
        100.00, // test price
        'active',
        'paid'
      ]
    );
    
    const booking = bookingResult.rows[0];
    
    // Create test payment
    const paymentResult = await client.query(
      `INSERT INTO payments
       (user_id, booking_id, stripe_payment_id, amount, currency, status, payment_type, stripe_charge_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        userId,
        booking.id,
        'pi_test_' + Date.now(),
        100.00,
        'usd',
        'succeeded',
        'payment',
        'ch_test_' + Date.now()
      ]
    );
    
    const payment = paymentResult.rows[0];
    
    await client.query('COMMIT');
    
    return { booking, payment };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error setting up test payment:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Cleans up database resources after tests
 */
async function teardownTestDatabase() {
  try {
    await pool.end();
    console.log(' Database pool closed successfully');
  } catch (error) {
    console.error('Error ending pool:', error);
  }
}

module.exports = {
  setupTestDatabase,
  teardownTestDatabase,
  verifyDatabaseConnection,
  setupTestPayment
};