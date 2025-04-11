// controllers/__tests__/messagesController.test.js
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../server');
const { resetTestDB, pool, createTestUser, createTestListing } = require('../../helpers/testSetup');
const { generateTokens } = require('../../services/tokenService');

// Reset database before all tests
beforeAll(async () => {
  await resetTestDB();
});

// Clean up connection after tests
afterAll(async () => {
  await pool.end();
  await new Promise(resolve => setTimeout(resolve, 500));
});

describe('Messages Controller', () => {
  let senderToken;
  let senderId;
  let receiverToken;
  let receiverId;
  let listingId;
  let bookingId;

  // Before each test, create two test users and a test listing
  beforeEach(async () => {
    // Create sender user
    const sender = await createTestUser();
    senderId = sender.id;
    
    // Generate a token for the sender
    const senderTokens = await generateTokens(senderId);
    senderToken = senderTokens.accessToken;
    
    // Create receiver user
    const receiver = await createTestUser();
    receiverId = receiver.id;
    
    // Generate a token for the receiver
    const receiverTokens = await generateTokens(receiverId);
    receiverToken = receiverTokens.accessToken;
    
    // Create a test listing owned by the receiver
    const listing = await createTestListing(receiverId);
    listingId = listing.id;
    
    // Create a test booking
    const bookingResult = await pool.query(
      `INSERT INTO bookings 
       (user_id, listing_id, booking_start, booking_end, total_price, status, payment_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        senderId,
        listingId,
        new Date('2025-05-01'),
        new Date('2025-05-02'),
        100.00,
        'active',
        'paid'
      ]
    );
    bookingId = bookingResult.rows[0].id;
  });

  // ==================== SEND MESSAGE TESTS ====================

  test('should send a message successfully', async () => {
    const response = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        receiverId: receiverId,
        content: 'Hello, this is a test message'
      });
    
    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Message sent successfully');
    expect(response.body.data).toBeDefined();
    expect(response.body.data.content).toBe('Hello, this is a test message');
    expect(response.body.data.sender_id).toBe(senderId);
    expect(response.body.data.receiver_id).toBe(receiverId);
  });

  test('should send a message with listing context', async () => {
    const response = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        receiverId: receiverId,
        content: 'Hello, I am interested in your listing',
        listingId: listingId
      });
    
    expect(response.status).toBe(201);
    expect(response.body.data.listing_id).toBe(listingId);
  });

  test('should send a message with booking context', async () => {
    const response = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        receiverId: receiverId,
        content: 'Hello, regarding my booking',
        bookingId: bookingId
      });
    
    expect(response.status).toBe(201);
    expect(response.body.data.booking_id).toBe(bookingId);
  });

  test('should return 400 if required fields are missing', async () => {
    const response = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        content: 'Missing receiver ID'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('required');
  });

  test('should return 401 if not authenticated', async () => {
    const response = await request(app)
      .post('/messages')
      .send({
        receiverId: receiverId,
        content: 'Hello, this is a test message'
      });
    
    expect(response.status).toBe(401);
  });

  test('should return 404 if listing does not exist', async () => {
    const nonExistentListingId = 9999;
    
    const response = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        receiverId: receiverId,
        content: 'Hello, I am interested in your listing',
        listingId: nonExistentListingId
      });
    
    expect(response.status).toBe(404);
    expect(response.body.message).toContain('Listing not found');
  });

  // ==================== GET CONVERSATION TESTS ====================

  test('should get conversation between two users', async () => {
    // First send a message to create a conversation
    await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        receiverId: receiverId,
        content: 'First message'
      });
    
    // Send a reply
    await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${receiverToken}`)
      .send({
        receiverId: senderId,
        content: 'Reply message'
      });
    
    // Get the conversation
    const response = await request(app)
      .get(`/messages/conversation/${receiverId}`)
      .set('Authorization', `Bearer ${senderToken}`);
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(2);
    expect(response.body[0].content).toBe('First message');
    expect(response.body[1].content).toBe('Reply message');
  });

  test('should return empty array for no messages', async () => {
    // Create another user with no conversation
    const anotherUser = await createTestUser();
    const anotherUserId = anotherUser.id;
    
    const response = await request(app)
      .get(`/messages/conversation/${anotherUserId}`)
      .set('Authorization', `Bearer ${senderToken}`);
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(0);
  });

  test('should not allow unauthorized access to conversations', async () => {
    const response = await request(app)
      .get(`/messages/conversation/${receiverId}`);
    
    expect(response.status).toBe(401);
  });

  // ==================== GET USER CONVERSATIONS TESTS ====================
  
  test('should get all conversations for a user', async () => {
    // Create another user and send messages to both
    const anotherUser = await createTestUser();
    const anotherUserId = anotherUser.id;
    
    // Send messages to create multiple conversations
    await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        receiverId: receiverId,
        content: 'Message to first user'
      });
    
    await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        receiverId: anotherUserId,
        content: 'Message to second user'
      });
    
    // Get all conversations
    const response = await request(app)
      .get('/messages/conversations')
      .set('Authorization', `Bearer ${senderToken}`);
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBe(2);
  });

  test('should not allow unauthorized access to user conversations', async () => {
    const response = await request(app)
      .get('/messages/conversations');
    
    expect(response.status).toBe(401);
  });

  // ==================== MARK MESSAGE AS READ TESTS ====================
  
  test('should mark messages as read', async () => {
    // Send a message from receiver to sender
    await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${receiverToken}`)
      .send({
        receiverId: senderId,
        content: 'Unread message'
      });
    
    // Mark messages as read
    const response = await request(app)
      .put(`/messages/${receiverId}/read`)
      .set('Authorization', `Bearer ${senderToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Messages marked as read');
    expect(Array.isArray(response.body.updatedIds)).toBe(true);
    expect(response.body.updatedIds.length).toBeGreaterThan(0);
  });

  test('should return empty array if no unread messages', async () => {
    // Create user with no messages
    const anotherUser = await createTestUser();
    const anotherUserId = anotherUser.id;
    
    const response = await request(app)
      .put(`/messages/${anotherUserId}/read`)
      .set('Authorization', `Bearer ${senderToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.updatedIds.length).toBe(0);
  });

  // ==================== INITIATE LISTING CONVERSATION TESTS ====================
  
  test('should initiate listing conversation successfully', async () => {
    const response = await request(app)
      .post('/messages/initiate-listing')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        listingId: listingId
      });
    
    expect(response.status).toBe(200);
    expect(response.body.receiverId).toBe(receiverId);
    expect(response.body.listingId).toBe(listingId);
  });

  test('should prevent initiating conversation with your own listing', async () => {
    // Create a listing for the sender
    const ownListing = await createTestListing(senderId);
    
    const response = await request(app)
      .post('/messages/initiate-listing')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        listingId: ownListing.id
      });
    
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Cannot message your own listing');
  });

  test('should return 404 for non-existent listing', async () => {
    const nonExistentListingId = 9999;
    
    const response = await request(app)
      .post('/messages/initiate-listing')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        listingId: nonExistentListingId
      });
    
    expect(response.status).toBe(404);
    expect(response.body.message).toContain('Listing not found');
  });

  // ==================== INITIATE BOOKING CONVERSATION TESTS ====================
  
  test('should initiate booking conversation from guest', async () => {
    const response = await request(app)
      .post('/messages/initiate-booking')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        bookingId: bookingId
      });
    
    expect(response.status).toBe(200);
    expect(response.body.receiverId).toBe(receiverId); // Host should be receiver
    expect(response.body.bookingId).toBe(bookingId);
  });

  test('should initiate booking conversation from host', async () => {
    const response = await request(app)
      .post('/messages/initiate-booking')
      .set('Authorization', `Bearer ${receiverToken}`)
      .send({
        bookingId: bookingId
      });
    
    expect(response.status).toBe(200);
    expect(response.body.receiverId).toBe(senderId); // Guest should be receiver
    expect(response.body.bookingId).toBe(bookingId);
  });

  test('should return 404 for non-existent booking', async () => {
    const nonExistentBookingId = 9999;
    
    const response = await request(app)
      .post('/messages/initiate-booking')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        bookingId: nonExistentBookingId
      });
    
    expect(response.status).toBe(404);
    expect(response.body.message).toContain('not found or unauthorized');
  });

  test('should not allow unauthorized users to initiate booking conversation', async () => {
    // Create another user who is not related to the booking
    const anotherUser = await createTestUser();
    const anotherUserTokens = await generateTokens(anotherUser.id);
    const anotherUserToken = anotherUserTokens.accessToken;
    
    const response = await request(app)
      .post('/messages/initiate-booking')
      .set('Authorization', `Bearer ${anotherUserToken}`)
      .send({
        bookingId: bookingId
      });
    
    expect(response.status).toBe(404);
    expect(response.body.message).toContain('not found or unauthorized');
  });

  // ==================== SECURITY & EDGE CASE TESTS ====================
  
  test('should prevent SQL injection in message content', async () => {
    const maliciousContent = "'); DROP TABLE messages; --";
    
    const response = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        receiverId: receiverId,
        content: maliciousContent
      });
    
    expect(response.status).toBe(201);
    
    // Verify database still intact by sending another message
    const secondResponse = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        receiverId: receiverId,
        content: 'Follow-up message'
      });
    
    expect(secondResponse.status).toBe(201);
  });

  test('should handle very long message content', async () => {
    const veryLongContent = 'A'.repeat(5000); // Very long message
    
    const response = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        receiverId: receiverId,
        content: veryLongContent
      });
    
    // Should either accept it (if TEXT type) or reject with 400 if there's validation
    expect([201, 400]).toContain(response.status);
  });
  test('should prevent XSS attacks in message content', async () => {
    const xssPayloads = [
      '<script>alert("XSS");</script>Malicious Message',
      'Message with <img src=x onerror=alert("XSS")>',
      'Embedded JavaScript: javascript:alert("XSS")'
    ];
  
    for (const payload of xssPayloads) {
      const response = await request(app)
        .post('/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          receiverId: receiverId,
          content: payload
        });
      
      expect(response.status).toBe(201);
      
      // Optional: Verify message is stored safely
      const conversationResponse = await request(app)
        .get(`/messages/conversation/${receiverId}`)
        .set('Authorization', `Bearer ${senderToken}`);
      
      const storedMessages = conversationResponse.body;
      const lastMessage = storedMessages[storedMessages.length - 1];
      
      expect(lastMessage.content).not.toContain('<script>');
      expect(lastMessage.content).not.toContain('onerror');
    }
  });
  
  test('should prevent excessive message content length', async () => {
    const testCases = [
      'A'.repeat(10000),  // Extremely long message
      '<script>' + 'A'.repeat(5000) + '</script>'  // Long malicious content
    ];
  
    for (const longContent of testCases) {
      const response = await request(app)
        .post('/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          receiverId: receiverId,
          content: longContent
        });
      
      // Should either reject or truncate
      expect([400, 201]).toContain(response.status);
      
      if (response.status === 201) {
        // If accepted, verify content is not full length
        expect(response.body.data.content.length).toBeLessThanOrEqual(5000);
      }
    }
  });
  
  test('should prevent sending messages to non-existent users', async () => {
    const nonExistentUserId = 99999;
    
    const response = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${senderToken}`)
      .send({
        receiverId: nonExistentUserId,
        content: 'Test message to non-existent user'
      });
    
    expect(response.status).toBe(400);
  });
  
  test('should validate message context integrity', async () => {
    const invalidContextCases = [
      { 
        receiverId: receiverId, 
        content: 'Message with invalid listing',
        listingId: 99999  // Non-existent listing
      },
      { 
        receiverId: receiverId, 
        content: 'Message with invalid booking',
        bookingId: 99999  // Non-existent booking
      }
    ];
  
    for (const invalidContext of invalidContextCases) {
      const response = await request(app)
        .post('/messages')
        .set('Authorization', `Bearer ${senderToken}`)
        .send(invalidContext);
      
      expect(response.status).toBe(404);
    }
  });
});