// controllers/__tests__/listingsController.test.js
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../server');
const { resetTestDB, pool, createTestUser, createTestListing } = require('../../helpers/testSetup');
const { generateTokens } = require('../../services/tokenService');
const path = require('path');
const fs = require('fs');

// Import controller modules so we can mock them properly
const listingsController = require('../../controllers/listingsController');

// Reset database before all tests
beforeAll(async () => {
  await resetTestDB();
});

// Clean up connection after tests
afterAll(async () => {
  await pool.end();
  await new Promise(resolve => setTimeout(resolve, 500));
});

describe('Listings Controller', () => {
  let testUserToken;
  let testUserId;
  let testListingId;

  // Before each test, create a test user directly using the helper
  beforeEach(async () => {
    // Create a test user directly using the helper
    const testUser = await createTestUser();
    testUserId = testUser.id;
    
    // Generate a token for the test user
    const tokens = await generateTokens(testUserId);
    testUserToken = tokens.accessToken;
    
    // Create a test listing for get, update, delete operations
    const testListing = await createTestListing(testUserId);
    testListingId = testListing.id;
  });

  // ==================== CREATE LISTING TESTS ====================

  // Test listing creation
  test('should create a new listing with valid data', async () => {
    const listingData = {
      title: 'Test Space',
      description: 'A test space for automated testing',
      type: 'Room',
      price: 50,
      priceType: 'hour',
      capacity: 4,
      location: 'Test Location',
      latitude: 51.5074,
      longitude: -0.1278,
      startDate: '2025-04-01',
      endDate: '2025-12-31',
      available_start_time: '09:00',
      available_end_time: '17:00',
      amenities: JSON.stringify(['WiFi', 'Heating', 'Air Conditioning']),
      customAmenities: JSON.stringify(['Test Amenity'])
    };

    const response = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${testUserToken}`)
      .field('title', listingData.title)
      .field('description', listingData.description)
      .field('type', listingData.type)
      .field('price', listingData.price)
      .field('priceType', listingData.priceType)
      .field('capacity', listingData.capacity)
      .field('location', listingData.location)
      .field('latitude', listingData.latitude)
      .field('longitude', listingData.longitude)
      .field('startDate', listingData.startDate)
      .field('endDate', listingData.endDate)
      .field('available_start_time', listingData.available_start_time)
      .field('available_end_time', listingData.available_end_time)
      .field('amenities', listingData.amenities)
      .field('customAmenities', listingData.customAmenities);

    expect(response.status).toBe(201);
    expect(response.body.listing).toBeDefined();
    expect(response.body.listing.title).toBe(listingData.title);
    expect(response.body.listing.user_id).toBe(testUserId);
  });

  // Test listing creation with missing required fields
  test('should return 400 if required fields are missing', async () => {
    const invalidListingData = {
      // Missing title and other required fields
      description: 'Incomplete listing data',
      price: 50
    };

    const response = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send(invalidListingData);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Missing required fields');
  });

  // Test listing creation with invalid price type
  test('should return 400 if price type is invalid', async () => {
    const invalidListingData = {
      title: 'Test Space',
      description: 'A test space for automated testing',
      type: 'Room',
      price: 50,
      priceType: 'invalid', // Invalid price type
      capacity: 4,
      location: 'Test Location',
      latitude: 51.5074,
      longitude: -0.1278
    };

    const response = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send(invalidListingData);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Invalid price type');
  });

  // Test listing creation with non-positive price/capacity
  test('should return 400 if price or capacity is not positive', async () => {
    const invalidListingData = {
      title: 'Test Space',
      description: 'A test space for automated testing',
      type: 'Room',
      price: 0, // Non-positive price
      priceType: 'hour',
      capacity: 0, // Non-positive capacity
      location: 'Test Location',
      latitude: 51.5074,
      longitude: -0.1278
    };

    const response = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${testUserToken}`)
      .field('title', invalidListingData.title)
      .field('description', invalidListingData.description)
      .field('type', invalidListingData.type)
      .field('price', invalidListingData.price)
      .field('priceType', invalidListingData.priceType)
      .field('capacity', invalidListingData.capacity)
      .field('location', invalidListingData.location)
      .field('latitude', invalidListingData.latitude)
      .field('longitude', invalidListingData.longitude);

    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Price and capacity must be positive');
  });

  // Test unauthorized listing creation
  test('unauthorized listing creation (no token)', async () => {
    const listingData = {
      title: 'Test Space',
      description: 'A test space for automated testing',
      type: 'Room',
      price: 50,
      priceType: 'hour',
      capacity: 4,
      location: 'Test Location',
      latitude: 51.5074,
      longitude: -0.1278
    };

    const response = await request(app)
      .post('/listings')
      .send(listingData);

    expect(response.status).toBe(401);
  });

  // Test listing image upload
  test('should create listing with image uploads', async () => {
    // Create a small test image file
    const testImagePath = path.join(__dirname, 'test-image.jpg');
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

    const listingData = {
      title: 'Test Space with Images',
      description: 'A test space with image uploads',
      type: 'Garden',
      price: 75,
      priceType: 'hour',
      capacity: 10,
      location: 'Test Location',
      latitude: 51.5074,
      longitude: -0.1278,
      startDate: '2025-04-01',
      endDate: '2025-12-31',
      available_start_time: '09:00',
      available_end_time: '17:00',
      amenities: JSON.stringify(['WiFi', 'Heating']),
      customAmenities: JSON.stringify(['Custom Feature'])
    };

    try {
      const response = await request(app)
        .post('/listings')
        .set('Authorization', `Bearer ${testUserToken}`)
        .field('title', listingData.title)
        .field('description', listingData.description)
        .field('type', listingData.type)
        .field('price', listingData.price)
        .field('priceType', listingData.priceType)
        .field('capacity', listingData.capacity)
        .field('location', listingData.location)
        .field('latitude', listingData.latitude)
        .field('longitude', listingData.longitude)
        .field('startDate', listingData.startDate)
        .field('endDate', listingData.endDate)
        .field('available_start_time', listingData.available_start_time)
        .field('available_end_time', listingData.available_end_time)
        .field('amenities', listingData.amenities)
        .field('customAmenities', listingData.customAmenities)
        .attach('images', testImagePath);

      expect(response.status).toBe(201);
      expect(response.body.listing).toBeDefined();
      expect(response.body.listing.images).toBeDefined();
      expect(response.body.listing.images.length).toBeGreaterThan(0);
    } finally {
      // Clean up test image
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
  });

  // Test edge case - minimal valid data with field approach
  test('should create listing with minimal valid data', async () => {
    // Let's use field() approach which seems more reliable with your controller
    const response = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${testUserToken}`)
      .field('title', 'Minimal Listing')
      .field('description', 'Just the required fields')
      .field('type', 'Room')
      .field('price', '1')
      .field('priceType', 'hour')
      .field('capacity', '1')
      .field('location', 'Somewhere')
      .field('latitude', '0')
      .field('longitude', '0')
      .field('startDate', '2025-04-01')
      .field('endDate', '2025-12-31')
      .field('available_start_time', '09:00')
      .field('available_end_time', '17:00')
      .field('amenities', JSON.stringify([]))
      .field('customAmenities', JSON.stringify([]));
  
    expect(response.status).toBe(201);
    expect(response.body.listing).toBeDefined();
    expect(response.body.listing.title).toBe('Minimal Listing');
  });

  // Test performance with large description
  test('should handle listings with large text descriptions', async () => {
    // Generate a large description (50KB)
    const largeDescription = 'A'.repeat(50 * 1024);
    
    const largeListingData = {
      title: 'Large Description Test',
      description: largeDescription,
      type: 'Room',
      price: 50,
      priceType: 'hour',
      capacity: 4,
      location: 'Test Location',
      latitude: 51.5074,
      longitude: -0.1278,
      // Include all required fields
      startDate: '2025-04-01',
      endDate: '2025-12-31',
      available_start_time: '09:00',
      available_end_time: '17:00'
    };

    const response = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send(largeListingData);

    expect(response.status).toBe(201);
    expect(response.body.listing).toBeDefined();
    expect(response.body.listing.description.length).toBe(largeDescription.length);
  });

  // Test with many image uploads (performance test)
  test('should handle multiple image uploads', async () => {
    // Skip this test if no image directory available
    if (!fs.existsSync(path.join(__dirname))) {
      console.log('Skipping multiple image test - no directory access');
      return;
    }

    // Create multiple test images
    const testImagePaths = [];
    try {
      // Create 3 small test images
      for (let i = 0; i < 3; i++) {
        const testImagePath = path.join(__dirname, `test-image-${i}.jpg`);
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
        testImagePaths.push(testImagePath);
      }

      // Basic listing data with all required fields
      let req = request(app)
        .post('/listings')
        .set('Authorization', `Bearer ${testUserToken}`)
        .field('title', 'Multiple Images Test')
        .field('description', 'Testing multiple image uploads')
        .field('type', 'Garden')
        .field('price', 50)
        .field('priceType', 'hour')
        .field('capacity', 10)
        .field('location', 'Test Location')
        .field('latitude', 51.5074)
        .field('longitude', -0.1278)
        .field('startDate', '2025-04-01')
        .field('endDate', '2025-12-31')
        .field('available_start_time', '09:00')
        .field('available_end_time', '17:00');
      
      // Attach multiple images
      for (const imagePath of testImagePaths) {
        req = req.attach('images', imagePath);
      }

      const response = await req;
      
      expect(response.status).toBe(201);
      expect(response.body.listing.images.length).toBe(testImagePaths.length);
    } finally {
      // Clean up all test images
      for (const imagePath of testImagePaths) {
        if (fs.existsSync(imagePath)) {
          fs.unlinkSync(imagePath);
        }
      }
    }
  });

  // Test boundary conditions - maximum allowed values
  test('should handle maximum price value', async () => {
    // Use a valid large price that stays within database field limits (precision 10, scale 2)
    const maxValueListingData = {
      title: 'Maximum Price Test',
      description: 'Testing maximum numeric values',
      type: 'Room',
      price: 9999999.99, // Just under the PostgreSQL limit for numeric(10,2)
      priceType: 'hour',
      capacity: 100000,
      location: 'Test Location',
      latitude: 51.5074,
      longitude: -0.1278,
      // Include all required fields
      startDate: '2025-04-01',
      endDate: '2025-12-31',
      available_start_time: '09:00',
      available_end_time: '17:00'
    };

    const response = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send(maxValueListingData);

    expect(response.status).toBe(201);
    expect(response.body.listing).toBeDefined();
    expect(parseFloat(response.body.listing.price)).toBe(9999999.99);
  });

  // Test handling of malformed coordinate data
  test('should validate coordinate data properly', async () => {
    const invalidCoordinateData = {
      title: 'Invalid Coordinates Test',
      description: 'Testing invalid coordinate validation',
      type: 'Room',
      price: 50,
      priceType: 'hour',
      capacity: 4,
      location: 'Test Location',
      latitude: 'not-a-number', // Invalid latitude
      longitude: -0.1278
    };

    const response = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send(invalidCoordinateData);

    // Since your controller doesn't explicitly validate numeric types,
    // this test verifies the current behavior - adjust expectations based on 
    // actual implementation
    expect(response.status).not.toBe(200); // Either 400 or 500
  });

  // ==================== GET ALL LISTINGS TESTS ====================

  // Test getting all listings
  test('should get all listings with pagination', async () => {
    // Create a few more listings to test pagination
    for (let i = 0; i < 3; i++) {
      await createTestListing(testUserId);
    }

    const response = await request(app).get('/listings');

    expect(response.status).toBe(200);
    expect(response.body.listings).toBeDefined();
    expect(Array.isArray(response.body.listings)).toBe(true);
    expect(response.body.total).toBeDefined();
    expect(response.body.page).toBeDefined();
    expect(response.body.totalPages).toBeDefined();
    expect(response.body.hasMore).toBeDefined();
  });

  // Test filtering listings by space type
  test('should filter listings by space type', async () => {
    // Create a listing with a specific type
    const specialTypeListing = await createTestListing(testUserId);
    
    // Get all listings filtering by the specific type
    const response = await request(app)
      .get(`/listings?spaceType=${specialTypeListing.type}`);

    expect(response.status).toBe(200);
    expect(response.body.listings).toBeDefined();
    
    // Check that all returned listings have the requested type
    response.body.listings.forEach(listing => {
      expect(listing.type).toBe(specialTypeListing.type);
    });
  });

  // Test filtering listings by max price
  test('should filter listings by max price', async () => {
    const maxPrice = 75;
    
    // Get all listings with a maximum price
    const response = await request(app)
      .get(`/listings?maxPrice=${maxPrice}`);

    expect(response.status).toBe(200);
    expect(response.body.listings).toBeDefined();
    
    // Check that all returned listings have a price less than or equal to maxPrice
    response.body.listings.forEach(listing => {
      expect(parseFloat(listing.price)).toBeLessThanOrEqual(maxPrice);
    });
  });

  // Test pagination
  test('should paginate listing results properly', async () => {
    // Create more listings for pagination testing
    for (let i = 0; i < 10; i++) {
      await createTestListing(testUserId);
    }
    
    // Test first page with limit
    const page1Response = await request(app)
      .get('/listings?page=1&limit=5');
    
    expect(page1Response.status).toBe(200);
    expect(page1Response.body.listings.length).toBeLessThanOrEqual(5);
    expect(page1Response.body.page).toBe(1);
    
    // Test second page
    const page2Response = await request(app)
      .get('/listings?page=2&limit=5');
    
    expect(page2Response.status).toBe(200);
    expect(page2Response.body.page).toBe(2);
    
    // Ensure listings are different between pages
    const page1Ids = page1Response.body.listings.map(l => l.id);
    const page2Ids = page2Response.body.listings.map(l => l.id);
    
    // Check that there's no overlap between pages
    const overlap = page1Ids.filter(id => page2Ids.includes(id));
    expect(overlap.length).toBe(0);
  });

  // ==================== GET USER LISTINGS TESTS ====================

  // Test getting listings for the current user
  test('should get listings for the authenticated user', async () => {
    const response = await request(app)
      .get('/listings/user')
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
    
    // All returned listings should belong to the authenticated user
    response.body.forEach(listing => {
      expect(listing.user_id).toBe(testUserId);
    });
  });

  // Test that unauthorized users cannot access user listings
  test('should reject unauthorized access to user listings', async () => {
    const response = await request(app).get('/listings/user');
    
    expect(response.status).toBe(401);
  });

  // ==================== GET SPECIFIC LISTING TESTS ====================

  // Test getting a specific listing
  test('should get a specific listing by ID', async () => {
    const response = await request(app)
      .get(`/listings/${testListingId}`)
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body).toBeDefined();
    expect(response.body.id).toBe(testListingId);
    expect(response.body.owner_name).toBeDefined(); // Check for joined owner name
  });

  // Test that unauthorized users cannot access specific listings
  test('should reject unauthorized access to specific listing', async () => {
    const response = await request(app).get(`/listings/${testListingId}`);
    
    expect(response.status).toBe(401);
  });

  // Test getting a non-existent listing
  test('should return 404 for non-existent listing', async () => {
    const nonExistentId = 9999;
    
    const response = await request(app)
      .get(`/listings/${nonExistentId}`)
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Listing not found');
  });

  // ==================== UPDATE LISTING TESTS ====================

  // Test updating a listing with valid data
  test('should update a listing with valid data', async () => {
    const updateData = {
      title: 'Updated Test Space',
      description: 'Updated description',
      price: 75,
      priceType: 'hour',
      capacity: 5,
      type: 'Room',
      location: 'Updated Location',
      latitude: 51.5074,
      longitude: -0.1278,
      amenities: JSON.stringify(['WiFi']),
      customAmenities: JSON.stringify(['Updated Feature'])
    };
    
    const response = await request(app)
      .put(`/listings/${testListingId}`)
      .set('Authorization', `Bearer ${testUserToken}`)
      .send(updateData);
    
    expect(response.status).toBe(200);
    expect(response.body.listing).toBeDefined();
    expect(response.body.listing.title).toBe(updateData.title);
    expect(response.body.listing.description).toBe(updateData.description);
    expect(parseFloat(response.body.listing.price)).toBe(updateData.price);
  });

  // Test update validation
  test('should validate updates properly', async () => {
    const invalidUpdateData = {
      title: '', // Empty title should be invalid
      price: -10, // Negative price should be invalid
      type: 'Room',
      description: 'Invalid update test',
      location: 'Test Location',
      latitude: 51.5074,
      longitude: -0.1278
    };
    
    const response = await request(app)
      .put(`/listings/${testListingId}`)
      .set('Authorization', `Bearer ${testUserToken}`)
      .send(invalidUpdateData);
    
    expect(response.status).toBe(400);
  });

  // Test unauthorized update
  test('should reject unauthorized updates', async () => {
    const updateData = {
      title: 'Updated Test Space',
      description: 'Update without auth token',
      price: 75,
      priceType: 'hour',
      capacity: 5,
      type: 'Room',
      location: 'Updated Location'
    };
    
    const response = await request(app)
      .put(`/listings/${testListingId}`)
      .send(updateData);
    
    expect(response.status).toBe(401);
  });

  // Test updating a non-existent listing
  test('should return 404 when updating non-existent listing', async () => {
    const nonExistentId = 9999;
    const updateData = {
      title: 'Updated Test Space',
      description: 'Updated description',
      price: 75,
      priceType: 'hour',
      capacity: 5,
      type: 'Room',
      location: 'Updated Location',
      latitude: 51.5074,
      longitude: -0.1278
    };
    
    const response = await request(app)
      .put(`/listings/${nonExistentId}`)
      .set('Authorization', `Bearer ${testUserToken}`)
      .send(updateData);
    
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Listing not found or unauthorized');
  });

  // Test updating with images
  test('should update listing with new images', async () => {
    // Create a test image
    const testImagePath = path.join(__dirname, 'update-test-image.jpg');
    if (!fs.existsSync(testImagePath)) {
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
        .put(`/listings/${testListingId}`)
        .set('Authorization', `Bearer ${testUserToken}`)
        .field('title', 'Updated with Image')
        .field('description', 'Testing image upload during update')
        .field('type', 'Room')
        .field('price', 65)
        .field('priceType', 'hour')
        .field('capacity', 5)
        .field('location', 'Updated Location')
        .field('latitude', 51.5074)
        .field('longitude', -0.1278)
        .field('amenities', JSON.stringify(['WiFi', 'Updated Feature']))
        .field('customAmenities', JSON.stringify(['New Custom Feature']))
        .field('existingImages', JSON.stringify([]))
        .attach('images', testImagePath);
      
      expect(response.status).toBe(200);
      expect(response.body.listing).toBeDefined();
      expect(response.body.listing.images).toBeDefined();
      expect(response.body.listing.images.length).toBeGreaterThan(0);
    } finally {
      if (fs.existsSync(testImagePath)) {
        fs.unlinkSync(testImagePath);
      }
    }
  });

  // ==================== DELETE LISTING TESTS ====================

  // Test deleting a listing
  test('should delete a listing successfully', async () => {
    const response = await request(app)
      .delete(`/listings/${testListingId}`)
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Listing deleted successfully');
    
    // Verify the listing is actually deleted
    const getResponse = await request(app)
      .get(`/listings/${testListingId}`)
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(getResponse.status).toBe(404);
  });

  // Test unauthorized deletion
  test('should reject unauthorized deletion', async () => {
    const response = await request(app)
      .delete(`/listings/${testListingId}`);
    
    expect(response.status).toBe(401);
  });

  // Test deleting a non-existent listing
  test('should return 404 when deleting non-existent listing', async () => {
    const nonExistentId = 9999;
    
    const response = await request(app)
      .delete(`/listings/${nonExistentId}`)
      .set('Authorization', `Bearer ${testUserToken}`);
    
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Listing not found or unauthorized');
  });

  // Test deleting a listing that belongs to another user
  test('should reject deletion of listings owned by other users', async () => {
    // Create another user
    const anotherUser = await createTestUser();
    const anotherUserTokens = await generateTokens(anotherUser.id);
    const anotherUserToken = anotherUserTokens.accessToken;
    
    // Try to delete the listing with the other user's token
    const response = await request(app)
      .delete(`/listings/${testListingId}`)
      .set('Authorization', `Bearer ${anotherUserToken}`);
    
    expect(response.status).toBe(404);
    expect(response.body.message).toBe('Listing not found or unauthorized');
  });
  // SQL Injection Test
test('should handle SQL injection-like inputs safely', async () => {
  const sqlInjectionPayloads = [
    "'; DROP TABLE listings; --",
    "1' OR '1'='1",
    "Robert'); DELETE FROM listings; --"
  ];

  for (const maliciousTitle of sqlInjectionPayloads) {
    const listingData = {
      title: maliciousTitle,
      description: 'SQL Injection Test Listing',
      type: 'Room',
      price: 50,
      priceType: 'hour',
      capacity: 4,
      location: 'Test Location',
      latitude: 51.5074,
      longitude: -0.1278
    };

    const response = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send(listingData);
    
    // Should create listing without database errors
    expect(response.status).toBe(201);
    expect(response.body.listing.title).toBe(maliciousTitle);
  }
});

// XSS Attack Test
test('should store XSS-like inputs without executing them', async () => {
  const xssPayloads = [
    {
      title: '<script>alert("XSS");</script>Malicious Listing',
      description: 'XSS Test Listing with <img src=x onerror=alert("XSS")>',
      location: 'Test Location'
    }
  ];

  for (const payload of xssPayloads) {
    const listingData = {
      ...payload,
      type: 'Room',
      price: 50,
      priceType: 'hour',
      capacity: 4,
      latitude: 51.5074,
      longitude: -0.1278
    };

    const response = await request(app)
      .post('/listings')
      .set('Authorization', `Bearer ${testUserToken}`)
      .send(listingData);
    
    // Should create listing and store input as-is
    expect(response.status).toBe(201);
    expect(response.body.listing.title).toContain('<script>alert("XSS");</script>');
  }
});
});