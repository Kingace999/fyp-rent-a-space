// controllers/__tests__/profileController.test.js
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../server');
const { resetTestDB, pool, createTestUser } = require('../../helpers/testSetup');
const { generateTokens } = require('../../services/tokenService');
const path = require('path');
const fs = require('fs');

// Reset database before all tests
beforeAll(async () => {
  await resetTestDB();
});

// Clean up connection after tests
afterAll(async () => {
  await pool.end();
  await new Promise(resolve => setTimeout(resolve, 500));
});

describe('Profile Controller', () => {
  let testUserToken;
  let testUserId;
  let secondTestUserId;
  let secondUserToken;

  // Before each test, create two test users directly using the helper
  beforeEach(async () => {
    // Create a test user directly using the helper
    const testUser = await createTestUser();
    testUserId = testUser.id;
    
    // Generate a token for the test user
    const tokens = await generateTokens(testUserId);
    testUserToken = tokens.accessToken;
    
    // Create a second user for testing getUserProfile
    // Modify the email to avoid unique constraint violations
    const secondUser = await createTestUser();
    secondTestUserId = secondUser.id;
    
    // Generate a token for the second user
    const secondTokens = await generateTokens(secondTestUserId);
    secondUserToken = secondTokens.accessToken;
  });

  // ==================== GET CURRENT USER PROFILE TESTS ====================

  // Test getting current user profile
  test('should get current user profile with all fields', async () => {
    const response = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    expect(response.body.id).toBe(testUserId);
    expect(response.body.name).toBeDefined();
    expect(response.body.email).toBeDefined();
    
    // Check if all expected fields are returned
    const expectedFields = [
      'id', 'name', 'email', 'location', 'phone', 
      'address', 'bio', 'hobbies', 'created_at', 'profile_image_url'
    ];
    
    expectedFields.forEach(field => {
      expect(response.body).toHaveProperty(field);
    });
  });

  // Test unauthorized access to profile
  test('should reject unauthorized access to current profile', async () => {
    const response = await request(app).get('/profile');
    
    expect(response.status).toBe(401);
  });

  // NEW TEST: Test with invalid token
  test('should reject access with invalid token', async () => {
    const response = await request(app)
      .get('/profile')
      .set('Authorization', 'Bearer invalidtoken12345');
    
    expect(response.status).toBe(403);
  });

  // ==================== GET ANOTHER USER'S PROFILE TESTS ====================

  // Test getting another user's profile (public info only)
  test('should get another user profile with public fields only', async () => {
    const response = await request(app)
      .get(`/profile/${secondTestUserId}`)
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    expect(response.body.id).toBe(secondTestUserId);
    expect(response.body.name).toBeDefined();
    
    // Check if only public fields are returned
    const expectedPublicFields = [
      'id', 'name', 'location', 'bio', 'hobbies', 'profile_image_url'
    ];
    
    expectedPublicFields.forEach(field => {
      expect(response.body).toHaveProperty(field);
    });
    
    // Ensure private fields are not returned
    const privateFields = ['email', 'phone', 'address'];
    
    privateFields.forEach(field => {
      expect(response.body).not.toHaveProperty(field);
    });
  });

  // Test getting a non-existent user's profile
  test('should return 404 for non-existent user profile', async () => {
    const nonExistentId = 9999;
    
    const response = await request(app)
      .get(`/profile/${nonExistentId}`)
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('User not found');
  });

  // Test unauthorized access to another user's profile
  test('should reject unauthorized access to another user profile', async () => {
    const response = await request(app).get(`/profile/${secondTestUserId}`);
    
    expect(response.status).toBe(401);
  });

  // NEW TEST: Test with invalid user ID format
  test('should handle invalid user ID format gracefully', async () => {
    const response = await request(app)
      .get('/profile/not-a-number')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    // Since this is a database lookup, it should return 404 or 400
    expect([404, 400]).toContain(response.status);
  });

  // ==================== UPDATE USER PROFILE TESTS ====================

  // Test updating user profile with valid data
  test('should update user profile with valid data', async () => {
    const updateData = {
      name: 'Updated Test User',
      location: 'New Location',
      phone: '1234567890',
      address: '123 Test St',
      bio: 'This is an updated test bio',
      hobbies: 'Reading, Writing, Testing'
    };
    
    const response = await request(app)
      .put('/profile')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send(updateData);
    
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Profile updated successfully');
    expect(response.body.user).toBeDefined();
    expect(response.body.user.name).toBe(updateData.name);
    expect(response.body.user.location).toBe(updateData.location);
    expect(response.body.user.phone).toBe(updateData.phone);
    expect(response.body.user.address).toBe(updateData.address);
    expect(response.body.user.bio).toBe(updateData.bio);
    expect(response.body.user.hobbies).toBe(updateData.hobbies);
  });

  // Test updating with partial data
  test('should update user profile with partial data', async () => {
    const partialUpdateData = {
      name: 'Partially Updated User',
      bio: 'Just updating name and bio'
    };
    
    // First, we'll save the original profile data
    const originalProfile = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${testUserToken}`);
      
    // Now update with partial data
    const response = await request(app)
      .put('/profile')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send(partialUpdateData);
    
    expect(response.status).toBe(200);
    expect(response.body.user).toBeDefined();
    expect(response.body.user.name).toBe(partialUpdateData.name);
    expect(response.body.user.bio).toBe(partialUpdateData.bio);
    
    // Make sure unchanged fields remain the same
    const unchangedFields = ['location', 'phone', 'address', 'hobbies'];
    unchangedFields.forEach(field => {
      // If the original field was null, it might be updated to null as well, which is fine
      if (originalProfile.body[field]) {
        expect(response.body.user[field]).toBe(originalProfile.body[field]);
      }
    });
  });

  // Test unauthorized profile update
  test('should reject unauthorized profile update', async () => {
    const updateData = {
      name: 'Unauthorized Update',
      bio: 'This update should be rejected'
    };
    
    const response = await request(app)
      .put('/profile')
      .send(updateData);
    
    expect(response.status).toBe(401);
  });

  // NEW TEST: Test with empty update fields
  test('should handle empty update fields properly', async () => {
    const emptyUpdateData = {
      name: '',
      bio: '',
      location: '',
      phone: '',
      address: '',
      hobbies: ''
    };
    
    const response = await request(app)
      .put('/profile')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send(emptyUpdateData);
    
    // Empty strings should be accepted as valid input
    expect(response.status).toBe(200);
  });

  // ==================== UPLOAD PROFILE IMAGE TESTS ====================

  // Test profile image upload
  test('should upload profile image successfully', async () => {
    // Create a small test image file
    const testImagePath = path.join(__dirname, 'test-profile-image.jpg');
    if (!fs.existsSync(testImagePath)) {
      // Create a small 1x1 JPEG image
      const buffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
        0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff, 0xff, 0xff, 0xff, 0xff, 0xc2, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00,
        0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x01, 0x3f,
        0x10
      ]);
      fs.writeFileSync(testImagePath, buffer);
    }

    try {
      const response = await request(app)
        .post('/profile/upload-image')
        .set('Authorization', `Bearer ${testUserToken}`)
        .attach('image', testImagePath);
      
      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Profile image uploaded successfully');
      expect(response.body.imageUrl).toBeDefined();
      expect(response.body.imageUrl).toContain('/uploads/');
      
      // Verify the image URL was saved to the user profile
      const profileResponse = await request(app)
        .get('/profile')
        .set('Authorization', `Bearer ${testUserToken}`);
        
      expect(profileResponse.body.profile_image_url).toBe(response.body.imageUrl);
    } finally {
      // Clean up test image
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
  });

  // Test upload without a file
  test('should return 400 when no image is provided', async () => {
    const response = await request(app)
      .post('/profile/upload-image')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('No file uploaded');
  });

  // Test unauthorized image upload
  test('should reject unauthorized image upload', async () => {
    // Create a small test image file
    const testImagePath = path.join(__dirname, 'test-profile-image.jpg');
    if (!fs.existsSync(testImagePath)) {
      const buffer = Buffer.from([
        0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
        // More image data...
      ]);
      fs.writeFileSync(testImagePath, buffer);
    }

    try {
      const response = await request(app)
        .post('/profile/upload-image')
        .attach('image', testImagePath);
      
      expect(response.status).toBe(401);
    } finally {
      // Clean up test image
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
  });

  // NEW TEST: Test uploading an image with wrong file type
  test('should reject non-image file uploads', async () => {
    // Create a fake text file with image extension
    const testFilePath = path.join(__dirname, 'fake-image.jpg');
    if (!fs.existsSync(testFilePath)) {
      fs.writeFileSync(testFilePath, 'This is not a real image file');
    }

    try {
      const response = await request(app)
        .post('/profile/upload-image')
        .set('Authorization', `Bearer ${testUserToken}`)
        .attach('image', testFilePath);
      
      // Should reject with 400 Bad Request
      expect([400, 415, 422]).toContain(response.status);
    } finally {
      // Clean up test file
      if (fs.existsSync(testFilePath)) {
        fs.unlinkSync(testFilePath);
      }
    }
  });

  // ==================== EDGE CASES & ERROR HANDLING ====================

  // Test updating with a name that's too long (if there's a constraint)
  test('should handle very long input values appropriately', async () => {
    const veryLongName = 'A'.repeat(1000);
    const veryLongBio = 'B'.repeat(5000);

    const updateData = {
      name: veryLongName,
      bio: veryLongBio
    };
    
    const response = await request(app)
      .put('/profile')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send(updateData);
    
    // The expected behavior depends on your database schema and validation
    // This test checks if your application handles the situation gracefully
    // Either by accepting truncated values or returning a proper error
    expect([200, 400]).toContain(response.status);
  });

  // Test for SQL injection attempts
  test('should prevent SQL injection in profile updates', async () => {
    const maliciousUpdateData = {
      name: "Robert'); DROP TABLE users; --",
      bio: "Malicious input"
    };
    
    const response = await request(app)
      .put('/profile')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send(maliciousUpdateData);
    
    expect(response.status).toBe(200);
    
    // Verify the database is still intact by fetching user profile
    const profileResponse = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.id).toBe(testUserId);
  });

  // NEW TEST: Test handling of invalid JSON in request body
  test('should handle invalid JSON in request body', async () => {
    const response = await request(app)
      .put('/profile')
      .set('Authorization', `Bearer ${testUserToken}`)
      .set('Content-Type', 'application/json')
      .send('{name: "Invalid JSON"'); // Missing closing brace
    
    // Should return 400 Bad Request
    expect(response.status).toBe(400);
  });

  // NEW TEST: Test concurrent profile updates
  test('should handle concurrent profile updates correctly', async () => {
    // Send two update requests simultaneously
    const firstUpdate = request(app)
      .put('/profile')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ name: 'Concurrent Update 1' });
      
    const secondUpdate = request(app)
      .put('/profile')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send({ name: 'Concurrent Update 2' });
    
    // Wait for both updates to complete
    const [firstResponse, secondResponse] = await Promise.all([
      firstUpdate,
      secondUpdate
    ]);
    
    // Both updates should succeed
    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    
    // Get the final state of the profile
    const profileResponse = await request(app)
      .get('/profile')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    // The profile should have the name from one of the updates
    expect(['Concurrent Update 1', 'Concurrent Update 2']).toContain(
      profileResponse.body.name
    );
  });
});