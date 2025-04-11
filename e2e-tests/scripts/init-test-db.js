// e2e-tests/scripts/init-test-db.js
const { Pool } = require('pg');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from e2e-tests/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function initTestDatabase() {
  const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT
  });

  try {
    console.log('Initializing test database schema...');
    
    const client = await pool.connect();
    try {
      // Start transaction
      await client.query('BEGIN');
      
      // Check if users table exists
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        );
      `);
      
      if (!tableExists.rows[0].exists) {
        console.log('Creating database schema for e2e tests...');
        
        // Create users table matching your actual schema
        await client.query(`
          CREATE TABLE users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            name VARCHAR(255) NOT NULL,
            location VARCHAR(255),
            phone VARCHAR(20),
            address TEXT,
            bio TEXT,
            hobbies TEXT,
            profile_image_url VARCHAR(255)
          )
        `);
        
        // Create listings table matching your actual schema
        await client.query(`
          CREATE TABLE listings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            title VARCHAR(100) NOT NULL,
            description TEXT NOT NULL,
            type VARCHAR(50) NOT NULL,
            custom_type VARCHAR(50),
            price NUMERIC(10,2) NOT NULL CHECK (price > 0),
            price_type VARCHAR(10) NOT NULL CHECK (price_type IN ('hour', 'day')),
            capacity INTEGER NOT NULL CHECK (capacity > 0),
            location VARCHAR(255) NOT NULL,
            latitude NUMERIC(9,6) NOT NULL,
            longitude NUMERIC(9,6) NOT NULL,
            amenities TEXT[],
            custom_amenities TEXT[],
            images TEXT[],
            start_date DATE NOT NULL,
            end_date DATE NOT NULL CHECK (start_date <= end_date),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            available_start_time TIME,
            available_end_time TIME,
            is_verified BOOLEAN DEFAULT FALSE
          )
        `);
        
        // Create bookings table - UPDATED to match your actual schema
        await client.query(`
          CREATE TABLE bookings (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
            booking_start TIMESTAMP NOT NULL,
            booking_end TIMESTAMP NOT NULL,
            total_price NUMERIC(10,2) NOT NULL CHECK (total_price > 0),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'completed', 'pending_update', 'pending_cancellation')),
            payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed')),
            cancelled_at TIMESTAMP,
            refund_amount NUMERIC(10,2) DEFAULT 0.00
          )
        `);
        
        // Create indexes for bookings
        await client.query(`CREATE INDEX idx_booking_user_id ON bookings(user_id)`);
        await client.query(`CREATE INDEX idx_booking_listing_id ON bookings(listing_id)`);
        await client.query(`CREATE INDEX idx_booking_status ON bookings(status)`);
        await client.query(`CREATE INDEX idx_booking_dates ON bookings(booking_start, booking_end)`);
        await client.query(`ALTER TABLE bookings ADD CONSTRAINT check_booking_dates CHECK (booking_start < booking_end)`);
        
        // Create messages table
        await client.query(`
          CREATE TABLE messages (
            id SERIAL PRIMARY KEY,
            sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            receiver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            listing_id INTEGER REFERENCES listings(id) ON DELETE CASCADE,
            message TEXT NOT NULL,
            is_read BOOLEAN DEFAULT FALSE,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Create payments table - NEW - Updated to match your schema
        await client.query(`
          CREATE TABLE payments (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            stripe_payment_id VARCHAR(255) NOT NULL,
            amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
            currency VARCHAR(10) NOT NULL DEFAULT 'usd',
            status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            payment_type VARCHAR(20) NOT NULL DEFAULT 'payment' CHECK (payment_type IN ('payment', 'refund', 'additional_charge')),
            original_payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
            stripe_charge_id VARCHAR(255),
            CONSTRAINT unique_refund_record UNIQUE (stripe_payment_id, payment_type)
          )
        `);
        
        // Create reviews table - UPDATED to match your exact schema
        await client.query(`
          CREATE TABLE reviews (
            id SERIAL PRIMARY KEY,
            listing_id INTEGER NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
            user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
            rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
            comment TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT now(),
            updated_at TIMESTAMP DEFAULT now(),
            CONSTRAINT reviews_booking_id_key UNIQUE (booking_id)
          )
        `);
        
        // Create indexes for reviews
        await client.query(`CREATE INDEX idx_reviews_user_id ON reviews(user_id)`);
        await client.query(`CREATE INDEX idx_reviews_listing_id ON reviews(listing_id)`);
        await client.query(`CREATE INDEX idx_reviews_booking_id ON reviews(booking_id)`);
        
        // Create indexes for listings
        await client.query(`CREATE INDEX idx_listings_user_id ON listings(user_id)`);
        await client.query(`CREATE INDEX idx_listings_verified ON listings(is_verified)`);
        
        console.log('Database schema created successfully');
      } else {
        console.log('Database schema already exists');
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
    
    console.log('Test database initialization complete');
  } catch (error) {
    console.error('Failed to initialize test database:', error);
  } finally {
    await pool.end();
  }
}

initTestDatabase();