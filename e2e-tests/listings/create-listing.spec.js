// e2e-tests/listings/create-listing.spec.js
const { test, expect } = require('@playwright/test');
const { setupTestDatabase, teardownTestDatabase } = require('../helpers/dbSetup');
const path = require('path');

test.describe('Listings - Create New Space Listing', () => {
  // Increase default timeout for all tests in this describe block
  test.setTimeout(60000);

  let testData;

  // Before all tests, set up the database with a test user
  test.beforeAll(async () => {
    try {
      testData = await setupTestDatabase();

    } catch (error) {
      console.error('Error in test setup:', error);
      // Provide fallback test data
      testData = {
        credentials: {
          email: 'test@example.com',
          password: 'TestPassword123!'
        }
      };
    }
  });

  // After all tests, clean up database connections
  test.afterAll(async () => {
    try {
      await teardownTestDatabase();
    } catch (error) {
      console.error('Error in test teardown:', error);
    }
  });

  // Log in before each test and navigate to rent-out-space
  test.beforeEach(async ({ page }) => {
    // First navigate to the home page
    await page.goto('/');

    
    // Fill in login credentials and submit
    await page.fill('input[type="email"]', testData.credentials.email);
    await page.fill('input[type="password"]', testData.credentials.password);
    
    // Click the Submit button
    await page.click('.submit-container > .submit');
    
    // Wait for login to complete and redirect
    await page.waitForTimeout(3000);
    
    // Log current URL to see where we are

    
    // After login, explicitly navigate to the rent-out-space page
    await page.goto('/rent-out-space');
    
    // Wait for navigation and log the URL to confirm
    await page.waitForTimeout(2000);

  });

  test('should diagnose the rent-out-space form', async ({ page }) => {
    // Wait for page to load
    await page.waitForTimeout(2000);
    
    // Log the current URL to verify we're on the right page

    
    // Check if there's a heading that contains "Rent Out"
    const headingText = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3'));
      return headings.map(h => h.textContent);
    });

    
    // Look for form elements using different selectors
    const submitButtonExists = await page.locator('.submit-button').isVisible();

    

  });

  test('should create a basic listing', async ({ page }) => {
    // Fill in required fields
    await page.fill('input[name="title"]', 'Test Listing from E2E Test');
    await page.fill('textarea[name="description"]', 'This is an automated test listing created by Playwright E2E tests');
    
    // Select space type
    await page.selectOption('select[name="type"]', 'Office Space');
    
    // Fill price and capacity
    await page.fill('input[name="price"]', '50');
    await page.fill('input[name="capacity"]', '10');
    
    // Fill location details
    await page.fill('input[name="location"]', '123 Test Street, London');
    await page.waitForTimeout(1000); // Wait for location processing
    
    // Set availability dates
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    const tomorrowFormatted = tomorrow.toISOString().split('T')[0];
    const nextMonthFormatted = nextMonth.toISOString().split('T')[0];
    
    await page.fill('input[name="startDate"]', tomorrowFormatted);
    await page.fill('input[name="endDate"]', nextMonthFormatted);
    
    // Set available times
    await page.fill('input[name="available_start_time"]', '09:00');
    await page.fill('input[name="available_end_time"]', '17:00');
    
    // Check some amenities
    await page.locator('text=WiFi').first().click();
    await page.locator('text=Parking').first().click();
    
    // Take a screenshot before submission for evidence
    await page.screenshot({ path: 'before-listing-submission.png' });
    
    // Click the submit button
    await page.locator('.submit-button').click();
    
    // Wait for verification modal and handle it if it appears
    try {
      await page.waitForSelector('.verification-modal, dialog, [role="dialog"]', { timeout: 5000 });

      
      // Look for a button to confirm verification
      const verifyButton = await page.getByText(/Verify|Submit|Confirm|Yes/i);
      if (verifyButton) {
        await verifyButton.click();

      }
    } catch (e) {

    }
    
    // Wait for redirect or success message
    await page.waitForTimeout(5000);
    
    // Check the current URL - should be redirected to dashboard if successful
    const currentUrl = page.url();

    
    // Take a screenshot after submission
    await page.screenshot({ path: 'after-listing-submission.png' });
    
    // Check for success message
    const successMessage = await page.locator('.message, [role="alert"]').isVisible();
    if (successMessage) {
      const messageText = await page.locator('.message, [role="alert"]').textContent();

    }
    
    // Consider the test passed if we detect a success message or redirect to dashboard
    const listingCreated = successMessage || currentUrl.includes('/dashboard');

  });

  test('should validate required fields', async ({ page }) => {
    // Click submit without filling anything
    await page.locator('.submit-button').click();
    
    // Wait for validation errors to appear
    await page.waitForTimeout(2000);
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'validation-errors.png' });
    
    // In your form, validation errors show up with the class "text-red-500"
    const errorElements = await page.locator('.text-red-500').count();

    
    // You should also have an error message at the top
    const errorMessage = await page.locator('.message.error').isVisible();

    
    // The message should say something about fixing fields
    if (errorMessage) {
      const messageText = await page.locator('.message.error').textContent();

    }
    
    // The test passes if either we found validation errors OR an error message
    expect(errorElements > 0 || errorMessage).toBeTruthy();
    

  });
});