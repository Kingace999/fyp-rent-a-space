// controllers/_tests_/paymentController.test.js
process.env.NODE_ENV = 'test';

const { resetTestDB, createTestUser, createTestListing, pool } = require('../../helpers/testSetup');
const jwt = require('jsonwebtoken');

// Create a mock DB connection function
const mockClientQuery = jest.fn().mockResolvedValue({ rows: [] });
const mockClient = {
  query: mockClientQuery,
  release: jest.fn(),
  COMMIT: jest.fn(),
  ROLLBACK: jest.fn()
};

// Mock the database pool queries for unit tests
jest.mock('../../config/db', () => ({
  query: jest.fn().mockResolvedValue({ rows: [] }),
  connect: jest.fn().mockResolvedValue(mockClient)
}));

// Mock the Stripe module
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => {
    return {
      paymentIntents: {
        create: jest.fn().mockResolvedValue({
          id: 'pi_test_123456789',
          client_secret: 'pi_test_cs_123456789',
          amount: 5000,
          currency: 'usd',
          status: 'succeeded',
          metadata: {}
        }),
        retrieve: jest.fn().mockResolvedValue({
          id: 'pi_test_123456789',
          charges: {
            data: [{
              id: 'ch_test_123456789',
              amount: 5000,
              amount_refunded: 0
            }]
          }
        })
      },
      refunds: {
        create: jest.fn().mockResolvedValue({
          id: 're_test_123456789',
          payment_intent: 'pi_test_123456789',
          amount: 5000,
          status: 'succeeded',
          charge: 'ch_test_123456789'
        }),
        list: jest.fn().mockResolvedValue({
          data: [{
            id: 're_test_123456789',
            payment_intent: 'pi_test_123456789',
            amount: 5000,
            status: 'succeeded',
            metadata: {
              refundType: 'cancellation',
              userId: '1',
              bookingId: '1',
              amount: '50.00'
            }
          }]
        })
      },
      webhooks: {
        constructEvent: jest.fn().mockImplementation((payload, signature, secret) => {
          return JSON.parse(payload);
        })
      }
    };
  });
});

// Mock the notifications controller
jest.mock('../../controllers/notificationsController', () => {
  return {
    createNotification: jest.fn().mockResolvedValue({ id: 1 })
  };
});

// Import the controller functions after mocks are set up
const { 
  createPaymentIntent, 
  createUpdatePaymentIntent, 
  processPartialRefund, 
  processBookingRefund, 
  handleWebhook 
} = require('../../controllers/paymentController');

// Reset database before tests
beforeAll(async () => {
  // Update resetTestDB function in testSetup.js to include payments table
  await resetTestDB();
});

// Clean up connection after tests
afterAll(async () => {
  await pool.end();
  
  // Add a small delay to ensure all connections are closed
  await new Promise(resolve => setTimeout(resolve, 500));
});

// Reset mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

// Helper function to generate a valid JWT token for testing
const generateTestToken = (userId) => {
  return jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
};

describe('Payment Controller - Unit Tests', () => {
  // CREATE PAYMENT INTENT TESTS
  // ==========================
  
  test('createPaymentIntent should return client secret with valid data', async () => {
    // Create a test user and listing for our payment
    const testUser = await createTestUser();
    const testListing = await createTestListing(testUser.id);
    
    // Create mock request and response objects
    const req = {
      user: { userId: testUser.id },
      body: {
        amount: 50.00,
        currency: 'usd',
        listing_id: testListing.id,
        startDate: '2025-04-01',
        endDate: '2025-04-03',
        priceType: 'day'
      }
    };
    
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    // Call the controller function directly
    await createPaymentIntent(req, res);
    
    // Verify the response
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      clientSecret: expect.any(String),
      message: 'Payment intent created successfully'
    }));
  });
  
  test('createPaymentIntent should return 400 with missing fields', async () => {
    // Create a test user
    const testUser = await createTestUser();
    
    // Missing required fields test cases
    const testCases = [
      { 
        body: { currency: 'usd', listing_id: 1, startDate: '2025-04-01' } // Missing amount
      },
      { 
        body: { amount: 50.00, listing_id: 1, startDate: '2025-04-01' } // Missing currency
      },
      { 
        body: { amount: 50.00, currency: 'usd', startDate: '2025-04-01' } // Missing listing_id
      },
      { 
        body: { amount: 50.00, currency: 'usd', listing_id: 1 } // Missing startDate
      }
    ];
    
    for (const testCase of testCases) {
      const req = {
        user: { userId: testUser.id },
        body: testCase.body
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      await createPaymentIntent(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Missing required fields' });
    }
  });

  // Add unit tests for createUpdatePaymentIntent
  test('createUpdatePaymentIntent should return client secret with valid data', async () => {
    const testUser = await createTestUser();
    
    const req = {
      user: { userId: testUser.id },
      body: {
        bookingId: 1,
        additionalAmount: 25.00,
        startDate: '2025-04-01',
        endDate: '2025-04-03',
        startTime: '14:00',
        endTime: '16:00',
        priceType: 'hour'
      }
    };
    
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    await createUpdatePaymentIntent(req, res);
    
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      clientSecret: expect.any(String),
      message: 'Update payment intent created successfully'
    }));
  });
  
  test('createUpdatePaymentIntent should return 400 with invalid parameters', async () => {
    const testUser = await createTestUser();
    
    const testCases = [
      { body: { additionalAmount: 25.00 } }, // Missing bookingId
      { body: { bookingId: 1 } }, // Missing additionalAmount
      { body: { bookingId: 1, additionalAmount: 0 } }, // Zero additionalAmount
      { body: { bookingId: 1, additionalAmount: -10 } } // Negative additionalAmount
    ];
    
    for (const testCase of testCases) {
      const req = {
        user: { userId: testUser.id },
        body: testCase.body
      };
      
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      
      await createUpdatePaymentIntent(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });
  
  // Add unit tests for processBookingRefund
  test('processBookingRefund should process refund successfully', async () => {
    const testUser = await createTestUser();
    
    // Setup mock client for this test
    mockClient.query.mockImplementation((query, params) => {
      // For the booking check query
      if (query.includes('SELECT * FROM bookings WHERE')) {
        return {
          rows: [{
            id: 1,
            user_id: testUser.id,
            booking_start: new Date('2025-04-01'),
            status: 'active',
            total_price: 100.00
          }]
        };
      }
      // For the payments query
      else if (query.includes('WITH RECURSIVE payment_refunds')) {
        return {
          rows: [{
            payment_id: 1,
            stripe_payment_id: 'pi_test_123456789',
            original_amount: 100.00,
            refunded_amount: 0,
            refundable_amount: 100.00,
            payment_type: 'payment'
          }]
        };
      }
      // Default return for other queries
      return { rows: [] };
    });
    
    const req = {
      user: { userId: testUser.id },
      params: { bookingId: 1 }
    };
    
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    await processBookingRefund(req, res);
    
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Refund processed successfully'
    }));
  });
  
  // Add unit tests for processPartialRefund
  test('processPartialRefund should process partial refund successfully', async () => {
    const testUser = await createTestUser();
    
    // Setup mock client for this test
    mockClient.query.mockImplementation((query, params) => {
      // For the payment query
      if (query.includes('SELECT p.*')) {
        return {
          rows: [{
            id: 1,
            user_id: testUser.id,
            booking_id: 1,
            stripe_payment_id: 'pi_test_123456789',
            amount: 100.00,
            currency: 'usd',
            status: 'succeeded',
            payment_type: 'payment'
          }]
        };
      }
      // Default return for other queries
      return { rows: [] };
    });
    
    const req = {
      user: { userId: testUser.id },
      body: {
        bookingId: 1,
        refundAmount: 25.00,
        newStartDate: '2025-04-01',
        newEndDate: '2025-04-02'
      }
    };
    
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    await processPartialRefund(req, res);
    
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Partial refund processed successfully',
      refundAmount: 25.00
    }));
  });
  
  // Test webhook handler for payment_intent.succeeded event
  test('handleWebhook should process payment_intent.succeeded events', async () => {
    // Setup mock client for this test
    mockClient.query.mockImplementation((query, params) => {
      // For the booking insert query
      if (query.includes('INSERT INTO bookings')) {
        return {
          rows: [{ id: 1 }]
        };
      }
      // Default return for other queries
      return { rows: [] };
    });
    
    const mockEvent = {
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123456789',
          metadata: {
            userId: '1',
            listing_id: '1',
            amount: '50.00',
            startDate: '2025-04-01',
            endDate: '2025-04-03',
            priceType: 'day'
          },
          latest_charge: 'ch_test_123456789'
        }
      }
    };
    
    const req = {
      body: JSON.stringify(mockEvent),
      headers: {
        'stripe-signature': 'test_signature'
      }
    };
    
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };
    
    await handleWebhook(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
  
  // Test webhook handler for charge.refunded event
  test('handleWebhook should process charge.refunded events', async () => {
    const mockEvent = {
      type: 'charge.refunded',
      data: {
        object: {
          id: 'ch_test_123456789',
          payment_intent: 'pi_test_123456789'
        }
      }
    };
    
    const req = {
      body: JSON.stringify(mockEvent),
      headers: {
        'stripe-signature': 'test_signature'
      }
    };
    
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn()
    };
    
    await handleWebhook(req, res);
    
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ received: true });
  });
});