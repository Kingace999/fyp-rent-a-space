// helpers/testSetup.js
const pool = require('../config/db.test'); 

// Function to reset test database tables before tests
const resetTestDB = async () => {
    try {
      // Drop existing tables if they exist
      await pool.query(`
        DROP TABLE IF EXISTS notifications CASCADE;
        DROP TABLE IF EXISTS messages CASCADE;
        DROP TABLE IF EXISTS payments CASCADE;
        DROP TABLE IF EXISTS bookings CASCADE;
        DROP TABLE IF EXISTS listings CASCADE;
        DROP TABLE IF EXISTS refresh_tokens CASCADE;
        DROP TABLE IF EXISTS users CASCADE;
      `);
      
      // Create tables needed for testing with all required columns
      await pool.query(`
        CREATE TABLE users (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(100) UNIQUE NOT NULL,
          password VARCHAR(100) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          location VARCHAR(255),
          phone VARCHAR(20),
          address TEXT,
          bio TEXT,
          hobbies TEXT,
          profile_image_url VARCHAR(255)
        );
        
        CREATE TABLE refresh_tokens (
          id SERIAL PRIMARY KEY,
          token TEXT NOT NULL,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          expires_at TIMESTAMP NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_revoked BOOLEAN DEFAULT false
        );

        -- Create listings table
        CREATE TABLE listings (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          title VARCHAR(100) NOT NULL,
          description TEXT NOT NULL,
          type VARCHAR(50) NOT NULL,
          custom_type VARCHAR(50),
          price NUMERIC(10,2) NOT NULL,
          price_type VARCHAR(10) NOT NULL,
          capacity INTEGER NOT NULL,
          location VARCHAR(255) NOT NULL,
          latitude NUMERIC(10,6) NOT NULL,
          longitude NUMERIC(10,6) NOT NULL,
          amenities TEXT[] DEFAULT '{}',
          custom_amenities TEXT[] DEFAULT '{}',
          start_date DATE,
          end_date DATE,
          available_start_time TIME,
          available_end_time TIME,
          images TEXT[] DEFAULT '{}',
          is_verified BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create bookings table
        CREATE TABLE bookings (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
          booking_start TIMESTAMP NOT NULL,
          booking_end TIMESTAMP NOT NULL,
          total_price NUMERIC(10,2) NOT NULL,
          status VARCHAR(30) NOT NULL,
          payment_status VARCHAR(30) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          cancelled_at TIMESTAMP,
          refund_amount NUMERIC(10,2)
        );

        -- Create payments table
        CREATE TABLE payments (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          booking_id INTEGER REFERENCES bookings(id) ON DELETE CASCADE,
          stripe_payment_id VARCHAR(100) NOT NULL,
          stripe_charge_id VARCHAR(100),
          amount NUMERIC(10,2) NOT NULL,
          currency VARCHAR(10) NOT NULL,
          status VARCHAR(30) NOT NULL,
          payment_type VARCHAR(30) NOT NULL,
          original_payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        -- Create messages table
        CREATE TABLE messages (
          id SERIAL PRIMARY KEY,
          sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          content TEXT NOT NULL,
          is_read BOOLEAN DEFAULT false,
          listing_id INTEGER REFERENCES listings(id) ON DELETE SET NULL,
          booking_id INTEGER,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        -- Create notifications table
        CREATE TABLE notifications (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          type VARCHAR(50) NOT NULL,
          message TEXT NOT NULL,
          related_id INTEGER,
          title VARCHAR(100),
          is_read BOOLEAN DEFAULT false,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      
      console.log('Test database tables created successfully');
    } catch (error) {
      console.error('Error resetting test database:', error);
    }
  };

// Function to create test data for tests
const createTestUser = async () => {
  try {
    // Generate a unique email using timestamp and random number
    const uniqueEmail = `test-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`;
    
    const result = await pool.query(
      `INSERT INTO users (name, email, password) 
       VALUES ($1, $2, $3) 
       RETURNING id, name, email`,
      ['Test User', uniqueEmail, '$2b$10$rM7hcOCTZW8Xd.J2Tomm4.FTh2ABcEpYHuCX55O4kTU0eNrCiySqi'] // Password is 'TestPassword123!'
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Error creating test user:', error);
    // Make sure to return null when there's an error
    return null;
  }
};

// Function to create a test listing
const createTestListing = async (userId) => {
  try {
    const result = await pool.query(
      `INSERT INTO listings 
        (user_id, title, description, type, price, price_type,
         capacity, location, latitude, longitude, amenities, 
         start_date, end_date, available_start_time, available_end_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) 
       RETURNING *`,
      [
        userId, 
        'Test Space', 
        'A test space for automated testing', 
        'Room', 
        50.00, 
        'hour', 
        4, 
        'Test Location', 
        51.5074, 
        -0.1278, 
        ['WiFi', 'Heating'], 
        '2025-04-01', 
        '2025-12-31', 
        '09:00', 
        '17:00'
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error creating test listing:', error);
  }
};

module.exports = {
  resetTestDB,
  createTestUser,
  createTestListing,
  pool
};