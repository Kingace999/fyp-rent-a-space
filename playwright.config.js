// @ts-check
const { defineConfig, devices } = require('@playwright/test');

// Hard-coded test env for simplicity
const testEnv = {
  NODE_ENV: 'test',
  DB_USER: 'postgres',
  DB_HOST: 'localhost',
  DB_NAME: 'fyp_rent_a_space_test',
  DB_PASSWORD: 'kingace999',
  DB_PORT: '5432'
};

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: './e2e-tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Disable screenshots completely */
    screenshot: 'off',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      // For Windows, we can't use NODE_ENV=test syntax
      command: 'cd backend && node server.js',
      url: 'http://localhost:5000',
      reuseExistingServer: !process.env.CI,
      env: testEnv,
      timeout: 30000,
    },
    {
      command: 'cd frontend && npm start',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
    }
  ],
});