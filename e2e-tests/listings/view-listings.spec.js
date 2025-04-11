// e2e-tests/listings/view-listings.spec.js
const { test, expect } = require('@playwright/test');
const { setupTestDatabase, teardownTestDatabase } = require('../helpers/dbSetup');

test.describe('Listings - View and Browse Listings', () => {
  // Increase default timeout for all tests in this describe block
  test.setTimeout(60000);

  let testData;

  // Before all tests, set up the database with a test user and listing
  test.beforeAll(async () => {
    try {
      testData = await setupTestDatabase();
      console.log('Test setup complete with user:', testData.credentials.email);
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

  // Log in before each test
  test.beforeEach(async ({ page }) => {
    // First navigate to the home page
    await page.goto('/');
    console.log('Navigated to home page');
    
    // Fill in login credentials and submit
    await page.fill('input[type="email"]', testData.credentials.email);
    await page.fill('input[type="password"]', testData.credentials.password);
    
    // Click the Submit button
    await page.click('.submit-container > .submit');
    
    // Wait for login to complete and redirect
    await page.waitForTimeout(3000);
    
    // Log current URL to see where we are
    console.log('URL after login:', page.url());
  });

  test('should display listings on dashboard', async ({ page }) => {
    // Dashboard should be loaded after login
    await expect(page.url()).toContain('/dashboard');
    
    // Check if listings are displayed
    const listingsVisible = await page.locator('.listing-card, .listing-grid div, [data-testid="listing"]').isVisible();
    console.log('Listings visible on dashboard:', listingsVisible);
    
    // Count the number of listings
    const listingCount = await page.locator('.listing-card, .listing-grid div, [data-testid="listing"]').count();
    console.log('Number of listings displayed:', listingCount);
    
    // Expect at least one listing to be visible
    expect(listingCount).toBeGreaterThan(0);
  });

  test('should filter listings by type', async ({ page }) => {
    // Check for filter controls
    const filterVisible = await page.locator('select, [data-testid="filter"], .filter').first().isVisible();
    console.log('Filter controls visible:', filterVisible);
    
    if (filterVisible) {
      // Select a specific type from the filter
      await page.selectOption('select', 'Office Space');
      // or try clicking a filter button if that's the UI approach
      // await page.click('button:has-text("Office Space")');
      
      // Wait for filtered results
      await page.waitForTimeout(2000);
      
      // Check if the filtered listings all have the correct type
      const listingTypes = await page.evaluate(() => {
        // Adapt this selector to your actual DOM structure
        const listings = document.querySelectorAll('.listing-card, .listing-grid div, [data-testid="listing"]');
        return Array.from(listings).map(listing => {
          // Extract the type from the listing card
          const typeElement = listing.querySelector('.listing-type, [data-type]');
          return typeElement ? typeElement.textContent.trim() : 'Unknown';
        });
      });
      
      console.log('Filtered listing types:', listingTypes);
      
      // Check if at least one listing matches the filter
      expect(listingTypes.some(type => type.includes('Office Space'))).toBeTruthy();
    } else {
      console.log('Filter controls not found, skipping filter test');
    }
  });

  test('should navigate to listing details', async ({ page }) => {
    // Find the first listing and click it
    const firstListing = page.locator('.listing-card, .listing-grid div, [data-testid="listing"]').first();
    await firstListing.click();
    
    // Wait for navigation
    await page.waitForTimeout(2000);
    
    // Check if we're on the listing details page
    const detailsVisible = await page.locator('h1, .listing-title, [data-testid="listing-title"]').isVisible();
    console.log('Listing details page loaded:', detailsVisible);
    
    // URL should contain listing ID
    expect(page.url()).toContain('/listing/');
    
    // Look for details like price, description, etc.
    const hasDetails = await page.locator('.listing-price, .listing-description, [data-testid="listing-details"]').isVisible();
    console.log('Listing details visible:', hasDetails);
    
    expect(hasDetails).toBeTruthy();
  });

  test('should view user listings', async ({ page }) => {
    // Navigate to my listings page
    await page.goto('/my-listings');
    await page.waitForTimeout(2000);
    
    console.log('Navigated to my listings page:', page.url());
    
    // Check if user listings are displayed
    const userListingsVisible = await page.locator('.listing-card, .listing-grid div, [data-testid="listing"]').isVisible();
    console.log('User listings visible:', userListingsVisible);
    
    // Check for controls to manage listings
    const manageControls = await page.locator('button:has-text("Edit"), button:has-text("Delete"), .edit-button, .delete-button').count();
    console.log('Management controls found:', manageControls);
    
    // Expect to find either listings or a message about no listings
    const contentVisible = userListingsVisible || 
                          await page.locator('text=No listings found, text=Create your first listing').isVisible();
    
    expect(contentVisible).toBeTruthy();
  });
});