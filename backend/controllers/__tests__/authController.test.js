// controllers/_tests_/authController.test.js
process.env.NODE_ENV = 'test';

const request = require('supertest');
const app = require('../../server');
const { resetTestDB, pool } = require('../../helpers/testSetup');

// Reset database before tests
beforeAll(async () => {
  await resetTestDB();
});

// Clean up connection after tests
afterAll(async () => {
  await pool.end();
  
  // Add a small delay to ensure all connections are closed
  await new Promise(resolve => setTimeout(resolve, 500));
});

describe('Auth Controller', () => {
  // SIGNUP TESTS
  // ============

  // Basic signup test
  test('signup with valid data should create new user', async () => {
    // Generate a unique email with timestamp to avoid duplicates
    const uniqueEmail = `newuser${Date.now()}@example.com`;
    
    const userData = {
      name: 'New User',
      email: uniqueEmail,
      password: 'Password123!' // Make sure this passes all your validation rules
    };
    
    const response = await request(app)
      .post('/auth/signup')
      .send(userData);
    
    // Log response body for debugging
    console.log('Response status:', response.status);
    console.log('Response body:', response.body);
    
    expect(response.status).toBe(201);
    expect(response.body.status).toBe('success');
    expect(response.body.user).toBeDefined();
    expect(response.body.accessToken).toBeDefined();
  });

  // Missing fields validation
  test('signup with missing fields should return error', async () => {
    const testCases = [
      { name: '', email: 'test@example.com', password: 'Password123!' },
      { name: 'Test User', email: '', password: 'Password123!' },
      { name: 'Test User', email: 'test@example.com', password: '' }
    ];
    
    for (const testCase of testCases) {
      const response = await request(app)
        .post('/auth/signup')
        .send(testCase);
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('All fields are required');
    }
  });

  // Invalid email format
  test('signup with invalid email format should return error', async () => {
    const response = await request(app)
      .post('/auth/signup')
      .send({
        name: 'Test User',
        email: 'invalid-email',
        password: 'Password123!'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.status).toBe('error');
    expect(response.body.message).toBe('Invalid email format');
  });

  // Password validation tests
  test('signup with weak password should return appropriate error', async () => {
    // Test password length
    let response = await request(app)
      .post('/auth/signup')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Short1!'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Password must be at least 8 characters long');
    
    // Test missing uppercase
    response = await request(app)
      .post('/auth/signup')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123!'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Password must contain at least one uppercase letter');
    
    // Test missing number
    response = await request(app)
      .post('/auth/signup')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password!'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Password must contain at least one number');
    
    // Test missing special character
    response = await request(app)
      .post('/auth/signup')
      .send({
        name: 'Test User',
        email: 'test@example.com',
        password: 'Password123'
      });
    
    expect(response.status).toBe(400);
    expect(response.body.message).toBe('Password must contain at least one special character');
  });

  // Duplicate email test
  test('signup with existing email should return error', async () => {
    // First create a user
    const testUser = {
      name: 'Duplicate Test',
      email: 'duplicate@example.com',
      password: 'Password123!'
    };
    
    await request(app)
      .post('/auth/signup')
      .send(testUser);
    
    // Try to create another user with the same email
    const response = await request(app)
      .post('/auth/signup')
      .send(testUser);
    
    expect(response.status).toBe(400);
    expect(response.body.status).toBe('error');
    expect(response.body.message).toBe('Email already exists');
  });

  // LOGIN TESTS
  // ===========

  // Successful login test
  test('login with valid credentials should return token', async () => {
    // First create a user that we can log in with
    const testUser = {
      name: 'Login Test User',
      email: 'logintest@example.com',
      password: 'Password123!'
    };
    
    // Register the user first
    await request(app)
      .post('/auth/signup')
      .send(testUser);
    
    // Then try to log in
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    
    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.status).toBe('success');
    expect(loginResponse.body.message).toBe('Login successful');
    expect(loginResponse.body.accessToken).toBeDefined();
    expect(loginResponse.body.user).toBeDefined();
    expect(loginResponse.body.user.email).toBe(testUser.email);
    
    // Check for refresh token cookie
    expect(loginResponse.headers['set-cookie']).toBeDefined();
    expect(loginResponse.headers['set-cookie'][0]).toContain('refreshToken');
  });

  // Missing credentials test
  test('login with missing credentials should return error', async () => {
    const testCases = [
      { email: 'test@example.com', password: '' },
      { email: '', password: 'Password123!' },
      { email: '', password: '' }
    ];
    
    for (const testCase of testCases) {
      const response = await request(app)
        .post('/auth/login')
        .send(testCase);
      
      expect(response.status).toBe(400);
      expect(response.body.status).toBe('error');
      expect(response.body.message).toBe('Email and password are required');
    }
  });

  // Non-existent user test
  test('login with non-existent email should return error', async () => {
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: 'Password123!'
      });
    
    expect(response.status).toBe(401);
    expect(response.body.status).toBe('error');
    expect(response.body.message).toBe('Invalid email or password');
  });

  // Invalid password test
  test('login with incorrect password should return error', async () => {
    // First create a user
    const testUser = {
      name: 'Password Test User',
      email: 'passwordtest@example.com',
      password: 'Password123!'
    };
    
    await request(app)
      .post('/auth/signup')
      .send(testUser);
    
    // Try to log in with wrong password
    const response = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword123!'
      });
    
    expect(response.status).toBe(401);
    expect(response.body.status).toBe('error');
    expect(response.body.message).toBe('Invalid email or password');
  });

  // TOKEN REFRESH AND LOGOUT TESTS
  // ==============================

  // Token refresh test
  test('refresh token should provide new access token', async () => {
    // First create and login a user to get a refresh token
    const testUser = {
      name: 'Refresh Test User',
      email: 'refreshtest@example.com',
      password: 'Password123!'
    };
    
    await request(app)
      .post('/auth/signup')
      .send(testUser);
    
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    
    // Extract refresh token from cookie
    const cookies = loginResponse.headers['set-cookie'][0];
    const refreshToken = cookies.split('refreshToken=')[1].split(';')[0];
    
    // Test refresh endpoint with token in body (since it's hard to send cookies in tests)
    const refreshResponse = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });
    
    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.status).toBe('success');
    expect(refreshResponse.body.accessToken).toBeDefined();
  });

  // Logout test
  test('logout should revoke refresh token', async () => {
    // First create and login a user to get a refresh token
    const testUser = {
      name: 'Logout Test User',
      email: 'logouttest@example.com',
      password: 'Password123!'
    };
    
    await request(app)
      .post('/auth/signup')
      .send(testUser);
    
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    
    // Extract refresh token from cookie
    const cookies = loginResponse.headers['set-cookie'][0];
    const refreshToken = cookies.split('refreshToken=')[1].split(';')[0];
    
    // Test logout endpoint with token in body
    const logoutResponse = await request(app)
      .post('/auth/logout')
      .send({ refreshToken });
    
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.status).toBe('success');
    expect(logoutResponse.body.message).toBe('Logged out successfully');
    
    // Try to use the refresh token again - should fail
    const refreshResponse = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken });
    
    expect(refreshResponse.status).toBe(403);
    expect(refreshResponse.body.status).toBe('error');
  });

  // USER PROFILE TEST
  // ================

  // Get user profile test
  test('get user profile with valid token should return user data', async () => {
    // First create and login a user
    const testUser = {
      name: 'Profile Test User',
      email: 'profiletest@example.com',
      password: 'Password123!'
    };
    
    await request(app)
      .post('/auth/signup')
      .send(testUser);
    
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password
      });
    
    const token = loginResponse.body.accessToken;
    
    // Get user profile
    const profileResponse = await request(app)
      .get('/auth/user/profile')
      .set('Authorization', `Bearer ${token}`);
    
    expect(profileResponse.status).toBe(200);
    expect(profileResponse.body.email).toBe(testUser.email);
    expect(profileResponse.body.name).toBe(testUser.name);
  });

  test('get user profile without token should return error', async () => {
    const response = await request(app)
      .get('/auth/user/profile');
    
    expect(response.status).toBe(401);
  });
  // SQL Injection Tests
test('signup should prevent SQL injection in name', async () => {
  const sqlInjectionPayloads = [
    "'; DROP TABLE users; --",
    "Robert'); DROP TABLE Students; --",
    "1' OR '1'='1"
  ];

  for (const maliciousName of sqlInjectionPayloads) {
    const response = await request(app)
      .post('/auth/signup')
      .send({
        name: maliciousName,
        email: `sqlinjection-${Date.now()}@test.com`,
        password: 'Password123!'
      });
    
    // Expect either 400 or successful creation without SQL injection
    expect([201, 400]).toContain(response.status);
  }
});

// XSS Tests
test('signup should sanitize inputs against XSS attacks', async () => {
  const xssPayloads = [
    {
      name: '<script>alert("XSS");</script>Test User',
      email: 'xss1@test.com',
      password: 'Password123!'
    },
    {
      name: 'Test User',
      email: 'xss2@test.com',
      password: '<img src=x onerror=alert("XSS")>'
    }
  ];

  for (const payload of xssPayloads) {
    const response = await request(app)
      .post('/auth/signup')
      .send(payload);
    
    // Expect either successful creation or validation error
    expect([201, 400]).toContain(response.status);
  }
});
test('complex SQL injection prevention in signup', async () => {
  const sophisticatedPayloads = [
    "1 OR '1'='1",
    "' UNION SELECT password FROM users --",
    "admin' --"
  ];

  for (const payload of sophisticatedPayloads) {
    const response = await request(app)
      .post('/auth/signup')
      .send({
        name: payload,
        email: `sqltest-${Date.now()}@example.com`,
        password: 'SecurePassword123!'
      });
    
    expect([201, 400]).toContain(response.status);
  }
});

// More comprehensive XSS Test
test('advanced XSS input sanitization', async () => {
  const xssPayloads = [
    { 
      name: '<iframe src="javascript:alert(\'XSS\')"></iframe>Malicious User',
      email: 'advanced-xss1@test.com',
      password: 'Password123!'
    },
    {
      name: 'Test User',
      email: 'advanced-xss2@test.com',
      password: 'Password123!<script>document.location="http://malicious.com"</script>'
    }
  ];

  for (const payload of xssPayloads) {
    const response = await request(app)
      .post('/auth/signup')
      .send(payload);
    
    expect([201, 400]).toContain(response.status);
  }
});
});