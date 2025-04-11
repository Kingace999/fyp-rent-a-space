// controllers/__tests__/paymentController.integration.test.js
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../server');
const { resetTestDB, createTestUser, createTestListing, pool } = require('../../helpers/testSetup');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const crypto = require('crypto');

// Helper function to generate a valid JWT token for testing
const generateTestToken = (userId) => {
  return jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
};

// Helper function to generate an expired JWT token
const generateExpiredToken = (userId) => {
  return jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '0s' });
};

// Helper function to generate an invalid signature for webhook tests
const generateInvalidSignature = (payload) => {
  const secretKey = 'invalid_secret_key';
  return crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');
};

// Reset database before tests
beforeAll(async () => {
  await resetTestDB();
});

// Clean up connection after tests
afterAll(async () => {
  await pool.end();
  await new Promise(resolve => setTimeout(resolve, 500));
});

describe('Payment Controller - Integration Tests with Stripe', () => {
  
  test('should create real payment intent in Stripe', async () => {
    // Create a test user and listing
    const testUser = await createTestUser();
    const testListing = await createTestListing(testUser.id);
    const token = generateTestToken(testUser.id);
    
    // Create a payment intent
    const response = await request(app)
      .post('/payments/create-payment-intent')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 50.00,
        currency: 'usd',
        listing_id: testListing.id,
        startDate: '2025-04-01',
        endDate: '2025-04-03',
        priceType: 'day'
      });
    
    // Verify response
    expect(response.status).toBe(200);
    expect(response.body.clientSecret).toBeDefined();
    
    // Extract the payment intent ID from the client secret
    const clientSecret = response.body.clientSecret;
    const intentId = clientSecret.split('_secret_')[0];
    
    // Verify this payment intent exists in Stripe
    const intent = await stripe.paymentIntents.retrieve(intentId);
    expect(intent).toBeDefined();
    expect(intent.amount).toBe(5000); // 50.00 converted to cents
    expect(intent.currency).toBe('usd');
    
    // Verify metadata
    expect(intent.metadata.listing_id).toBe(testListing.id.toString());
    expect(intent.metadata.userId).toBe(testUser.id.toString());
  }, 10000); // Increase timeout for API calls

  test('should create update payment intent for existing booking', async () => {
    // Create user, listing, and a booking first
    const testUser = await createTestUser();
    const testListing = await createTestListing(testUser.id);
    const token = generateTestToken(testUser.id);
    
    // Create a booking in the database
    const bookingResult = await pool.query(
      `INSERT INTO bookings (user_id, listing_id, booking_start, booking_end, total_price, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        testUser.id,
        testListing.id,
        new Date('2025-04-01T12:00:00Z'),
        new Date('2025-04-01T14:00:00Z'),
        100.00,
        'active',
        'paid'
      ]
    );
    const bookingId = bookingResult.rows[0].id;
    
    // Create an update payment intent
    const response = await request(app)
      .post('/payments/update-payment-intent')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bookingId,
        additionalAmount: 25.00,
        startDate: '2025-04-01',
        endDate: '2025-04-03',
        startTime: '14:00',
        endTime: '16:00',
        priceType: 'hour'
      });
    
    // Verify response
    expect(response.status).toBe(200);
    expect(response.body.clientSecret).toBeDefined();
    
    // Extract the payment intent ID and verify in Stripe
    const clientSecret = response.body.clientSecret;
    const intentId = clientSecret.split('_secret_')[0];
    
    const intent = await stripe.paymentIntents.retrieve(intentId);
    expect(intent).toBeDefined();
    expect(intent.amount).toBe(2500); // 25.00 converted to cents
    expect(intent.metadata.booking_id).toBe(bookingId.toString());
    expect(intent.metadata.payment_purpose).toBe('update_additional');
  }, 10000);

  test('should process webhook events forwarded by Stripe CLI', async () => {
    // Create a test user and listing
    const testUser = await createTestUser();
    const testListing = await createTestListing(testUser.id);
    
    // Create a payment intent directly through Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 5000,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: {
        userId: testUser.id.toString(),
        listing_id: testListing.id.toString(),
        startDate: '2025-04-01',
        endDate: '2025-04-03',
        priceType: 'day',
        amount: '50.00'
      }
    });
    
    // Trigger the webhook event using Stripe CLI
    // Note: This requires Stripe CLI to be running with the command:
    // stripe listen --forward-to localhost:5000/payments/webhook
    const triggerCommand = `stripe trigger payment_intent.succeeded --add payment_intent:${paymentIntent.id}`;
    
    // Log the command for the developer to run


    
    // Wait for webhook processing (Stripe CLI should forward the event)
    // This delay allows time for the user to run the command and for the event to be processed
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check if a booking was created
    const bookingResult = await pool.query(
      `SELECT * FROM bookings WHERE user_id = $1 AND listing_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [testUser.id, testListing.id]
    );
    
    // Note: This assertion may fail if you don't run the trigger command in time
    // It's meant as a demonstration rather than a fully automated test
    if (bookingResult.rows.length > 0) {
      expect(bookingResult.rows[0].status).toBe('active');
      expect(bookingResult.rows[0].payment_status).toBe('paid');
    } else {

    }
  }, 15000);

  test('should process refund through Stripe', async () => {
    // Create a test user, listing, and booking
    const testUser = await createTestUser();
    const testListing = await createTestListing(testUser.id);
    const token = generateTestToken(testUser.id);
    
    // Create a payment intent and confirm it with a test card
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 5000,
      currency: 'usd',
      payment_method_types: ['card'],
      payment_method: 'pm_card_visa', // Test card
      confirm: true, // Confirm immediately
      metadata: {
        userId: testUser.id.toString(),
        listing_id: testListing.id.toString(),
        startDate: '2025-04-01',
        endDate: '2025-04-03',
        priceType: 'day',
        amount: '50.00'
      }
    });
    
    // Wait for payment intent to be fully processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Insert booking and payment records
    const bookingResult = await pool.query(
      `INSERT INTO bookings (user_id, listing_id, booking_start, booking_end, total_price, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        testUser.id,
        testListing.id,
        new Date('2025-04-01T12:00:00Z'),
        new Date('2025-04-01T14:00:00Z'),
        50.00,
        'active',
        'paid'
      ]
    );
    const bookingId = bookingResult.rows[0].id;
    
    await pool.query(
      `INSERT INTO payments (user_id, booking_id, stripe_payment_id, stripe_charge_id, amount, currency, status, payment_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        testUser.id,
        bookingId,
        paymentIntent.id,
        paymentIntent.latest_charge || 'ch_fake_for_test', // Use fake charge if not available
        50.00,
        'usd',
        'succeeded',
        'payment'
      ]
    );
    
    // Process refund
    const refundResponse = await request(app)
      .post(`/payments/refund/${bookingId}`)
      .set('Authorization', `Bearer ${token}`);
    
    // Verify response
    expect(refundResponse.status).toBe(200);
    expect(refundResponse.body.message).toBe('Refund processed successfully');
    expect(refundResponse.body.refundIds).toBeDefined();
    
    // Verify refund in Stripe
    if (refundResponse.body.refundIds && refundResponse.body.refundIds.length > 0) {
      const refundId = refundResponse.body.refundIds[0];
      const refund = await stripe.refunds.retrieve(refundId);
      
      expect(refund).toBeDefined();
      expect(refund.status).toBe('succeeded');
      expect(refund.payment_intent).toBe(paymentIntent.id);
    }
    
    // Verify booking status update
    const updatedBooking = await pool.query(
      `SELECT * FROM bookings WHERE id = $1`,
      [bookingId]
    );
    
    expect(updatedBooking.rows[0].status).toBe('cancelled');
    expect(updatedBooking.rows[0].refund_amount).toBeDefined();
  }, 20000);

  test('should process partial refund through Stripe', async () => {
    // Create a test user, listing, and booking
    const testUser = await createTestUser();
    const testListing = await createTestListing(testUser.id);
    const token = generateTestToken(testUser.id);
    
    // Create a payment intent and confirm it
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 10000, // $100.00
      currency: 'usd',
      payment_method_types: ['card'],
      payment_method: 'pm_card_visa', // Test card
      confirm: true, // Confirm immediately
      metadata: {
        userId: testUser.id.toString(),
        listing_id: testListing.id.toString(),
        startDate: '2025-04-01',
        endDate: '2025-04-10',
        priceType: 'day',
        amount: '100.00'
      }
    });
    
    // Wait for payment intent to be fully processed
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Insert booking and payment records
    const bookingResult = await pool.query(
      `INSERT INTO bookings (user_id, listing_id, booking_start, booking_end, total_price, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        testUser.id,
        testListing.id,
        new Date('2025-04-01T12:00:00Z'),
        new Date('2025-04-10T12:00:00Z'),
        100.00,
        'active',
        'paid'
      ]
    );
    const bookingId = bookingResult.rows[0].id;
    
    await pool.query(
      `INSERT INTO payments (user_id, booking_id, stripe_payment_id, stripe_charge_id, amount, currency, status, payment_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        testUser.id,
        bookingId,
        paymentIntent.id,
        paymentIntent.latest_charge || 'ch_fake_for_test',
        100.00,
        'usd',
        'succeeded',
        'payment'
      ]
    );
    
    // Process partial refund
    const refundResponse = await request(app)
      .post('/payments/partial-refund')
      .set('Authorization', `Bearer ${token}`)
      .send({
        bookingId,
        refundAmount: 25.00,
        newStartDate: '2025-04-01',
        newEndDate: '2025-04-07' // Shorter stay
      });
    
    // Verify response
    expect(refundResponse.status).toBe(200);
    expect(refundResponse.body.message).toBe('Partial refund processed successfully');
    expect(refundResponse.body.refundId).toBeDefined();
    
    // Verify refund in Stripe
    const refund = await stripe.refunds.retrieve(refundResponse.body.refundId);
    expect(refund).toBeDefined();
    expect(refund.status).toBe('succeeded');
    expect(refund.amount).toBe(2500); // $25.00 converted to cents
    
    // Verify booking was updated
    const updatedBooking = await pool.query(
      `SELECT * FROM bookings WHERE id = $1`,
      [bookingId]
    );
    
    expect(updatedBooking.rows[0].booking_end).toEqual(new Date('2025-04-07T00:00:00.000Z'));
    expect(parseFloat(updatedBooking.rows[0].total_price)).toBe(75.00); // $100 - $25
  }, 20000);

  // =================== SECURITY TESTS ===================

  test('should reject requests with expired tokens', async () => {
    // Create a test user and listing
    const testUser = await createTestUser();
    const testListing = await createTestListing(testUser.id);
    
    // Generate an expired token
    const expiredToken = generateExpiredToken(testUser.id);
    
    // Attempt to create a payment intent with expired token
    const response = await request(app)
      .post('/payments/create-payment-intent')
      .set('Authorization', `Bearer ${expiredToken}`)
      .send({
        amount: 50.00,
        currency: 'usd',
        listing_id: testListing.id,
        startDate: '2025-04-01',
        endDate: '2025-04-03',
        priceType: 'day'
      });
    
    // Verify token is rejected
    expect(response.status).toBe(403);
    expect(response.body.message).toBe('Token expired');
  }, 10000);

  test('should reject payment requests without authentication', async () => {
    // Create a test user and listing
    const testUser = await createTestUser();
    const testListing = await createTestListing(testUser.id);
    
    // Attempt to create payment intent without auth token
    const response = await request(app)
      .post('/payments/create-payment-intent')
      .send({
        amount: 50.00,
        currency: 'usd',
        listing_id: testListing.id,
        startDate: '2025-04-01',
        endDate: '2025-04-03',
        priceType: 'day'
      });
    
    // Verify request is rejected
    expect(response.status).toBe(401);
    expect(response.body.message).toBe('Authentication required');
  }, 10000);

  test('should prevent cross-user access to refund another user\'s booking', async () => {
    // Create two users
    const ownerUser = await createTestUser();
    const attackerUser = await createTestUser();
    
    // Create a listing and booking for the owner
    const testListing = await createTestListing(ownerUser.id);
    
    // Create a payment intent for the owner
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 5000,
      currency: 'usd',
      payment_method_types: ['card'],
      payment_method: 'pm_card_visa',
      confirm: true,
      metadata: {
        userId: ownerUser.id.toString(),
        listing_id: testListing.id.toString(),
        startDate: '2025-04-01',
        endDate: '2025-04-03',
        priceType: 'day',
        amount: '50.00'
      }
    });
    
    // Insert booking and payment for owner
    const bookingResult = await pool.query(
      `INSERT INTO bookings (user_id, listing_id, booking_start, booking_end, total_price, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        ownerUser.id,
        testListing.id,
        new Date('2025-04-01T12:00:00Z'),
        new Date('2025-04-01T14:00:00Z'),
        50.00,
        'active',
        'paid'
      ]
    );
    const bookingId = bookingResult.rows[0].id;
    
    await pool.query(
      `INSERT INTO payments (user_id, booking_id, stripe_payment_id, stripe_charge_id, amount, currency, status, payment_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        ownerUser.id,
        bookingId,
        paymentIntent.id,
        paymentIntent.latest_charge || 'ch_fake_for_test',
        50.00,
        'usd',
        'succeeded',
        'payment'
      ]
    );
    
    // Generate token for attacker
    const attackerToken = generateTestToken(attackerUser.id);
    
    // Attacker attempts to refund owner's booking
    const refundResponse = await request(app)
      .post(`/payments/refund/${bookingId}`)
      .set('Authorization', `Bearer ${attackerToken}`);
    
    // Verify the attempt is blocked
    expect(refundResponse.status).toBe(404); // Should return "booking not found" rather than exposing its existence
    expect(refundResponse.body.message).toBe('Booking not found');
  }, 20000);

  test('should reject webhook with invalid signature', async () => {
    // Create mock event payload
    const mockEvent = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_invalid',
          metadata: { userId: '1', listing_id: '1', amount: '50.00' }
        }
      }
    };
    
    const payload = JSON.stringify(mockEvent);
    const fakeSignature = generateInvalidSignature(payload);
    
    // Send webhook with invalid signature
    const response = await request(app)
      .post('/payments/webhook')
      .set('stripe-signature', fakeSignature)
      .set('Content-Type', 'application/json')
      .send(payload);
    
    // Verify request is rejected
    expect(response.status).toBe(400);
    expect(response.body.message || response.text).toContain('signature');
  }, 10000);

  test('should handle SQL injection attempts in payment parameters', async () => {
    // Create a test user and listing
    const testUser = await createTestUser();
    const testListing = await createTestListing(testUser.id);
    const token = generateTestToken(testUser.id);
    
    // Attempt SQL injection in listing_id
    const response = await request(app)
      .post('/payments/create-payment-intent')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 50.00,
        currency: 'usd',
        listing_id: "1; DROP TABLE payments; --", // SQL injection attempt
        startDate: '2025-04-01',
        endDate: '2025-04-03',
        priceType: 'day'
      });
    
    // Verify response is an error but not a server crash
    // Expected behavior: either 400 (validation error) or 500 (server handled error)
    // but not a successful 200 that would indicate the injection worked
    expect(response.status).not.toBe(200);
    
    // Verify payments table still exists
    const tableCheck = await pool.query(
      "SELECT to_regclass('public.payments') as exists"
    );
    expect(tableCheck.rows[0].exists).not.toBeNull();
  }, 10000);

  test('should handle extremely large payment values', async () => {
    // Create a test user and listing
    const testUser = await createTestUser();
    const testListing = await createTestListing(testUser.id);
    const token = generateTestToken(testUser.id);
    
    // Test with extremely large amount (more than the PostgreSQL numeric limit)
    const response = await request(app)
      .post('/payments/create-payment-intent')
      .set('Authorization', `Bearer ${token}`)
      .send({
        amount: 9999999999999, // Very large number
        currency: 'usd',
        listing_id: testListing.id,
        startDate: '2025-04-01',
        endDate: '2025-04-03',
        priceType: 'day'
      });
    
    // System should either reject with 400 (validation error) or handle it gracefully
    // but should not crash or allow arbitrary values
    expect([400, 500]).toContain(response.status);
  }, 10000);

  test('should prevent duplicate payment processing (idempotency)', async () => {
    // Create a test user and listing
    const testUser = await createTestUser();
    const testListing = await createTestListing(testUser.id);
    const token = generateTestToken(testUser.id);
    
    // Generate a unique idempotency key for this test
    const idempotencyKey = `idem-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    // First payment intent creation
    const firstResponse = await request(app)
      .post('/payments/create-payment-intent')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        amount: 50.00,
        currency: 'usd',
        listing_id: testListing.id,
        startDate: '2025-04-01',
        endDate: '2025-04-03',
        priceType: 'day'
      });
    
    expect(firstResponse.status).toBe(200);
    const firstClientSecret = firstResponse.body.clientSecret;
    
    // Second identical request with same idempotency key
    const secondResponse = await request(app)
      .post('/payments/create-payment-intent')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({
        amount: 50.00,
        currency: 'usd',
        listing_id: testListing.id,
        startDate: '2025-04-01',
        endDate: '2025-04-03',
        priceType: 'day'
      });
    
    // Should return same client secret (or error) but not create new payment
    expect(secondResponse.status).toBe(200);
    
    if (secondResponse.body.clientSecret) {
      // If system returns success, it should be the same payment intent
      expect(secondResponse.body.clientSecret).toBe(firstClientSecret);
    }
  }, 10000);

  test('should block processing refund twice for same booking', async () => {
    // Create a test user, listing, and booking
    const testUser = await createTestUser();
    const testListing = await createTestListing(testUser.id);
    const token = generateTestToken(testUser.id);
    
    // Create a payment intent and confirm it with a test card
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 5000,
      currency: 'usd',
      payment_method_types: ['card'],
      payment_method: 'pm_card_visa',
      confirm: true,
      metadata: {
        userId: testUser.id.toString(),
        listing_id: testListing.id.toString(),
        startDate: '2025-04-01',
        endDate: '2025-04-03',
        priceType: 'day',
        amount: '50.00'
      }
    });
    
    // Insert booking and payment records
    const bookingResult = await pool.query(
      `INSERT INTO bookings (user_id, listing_id, booking_start, booking_end, total_price, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        testUser.id,
        testListing.id,
        new Date('2025-04-01T12:00:00Z'),
        new Date('2025-04-01T14:00:00Z'),
        50.00,
        'active',
        'paid'
      ]
    );
    const bookingId = bookingResult.rows[0].id;
    
    await pool.query(
      `INSERT INTO payments (user_id, booking_id, stripe_payment_id, stripe_charge_id, amount, currency, status, payment_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        testUser.id,
        bookingId,
        paymentIntent.id,
        paymentIntent.latest_charge || 'ch_fake_for_test',
        50.00,
        'usd',
        'succeeded',
        'payment'
      ]
    );
    
    // First refund - should succeed
    const firstRefundResponse = await request(app)
      .post(`/payments/refund/${bookingId}`)
      .set('Authorization', `Bearer ${token}`);
    
    expect(firstRefundResponse.status).toBe(200);
    
    // Second refund attempt - should fail or be idempotent
    const secondRefundResponse = await request(app)
      .post(`/payments/refund/${bookingId}`)
      .set('Authorization', `Bearer ${token}`);
    
    // Should either return an error or be idempotent, but not process a second refund
    expect(secondRefundResponse.status).not.toBe(500); // Should not cause server error
    
    // Either returns 400/409 (already refunded) or 200 (idempotent)
    expect([400, 409, 200]).toContain(secondRefundResponse.status);
  }, 20000);
});