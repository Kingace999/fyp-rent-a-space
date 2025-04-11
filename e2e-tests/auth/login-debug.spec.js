// e2e-tests/auth/login-debug.spec.js
const { test, expect } = require('@playwright/test');

test('diagnose login page elements', async ({ page }) => {
  // Try root URL
  await page.goto('/');

  
  // Take screenshot to see what's on the page
  await page.screenshot({ path: 'root-page.png' });
  
  // Examine the HTML structure
  const rootHtml = await page.evaluate(() => document.documentElement.outerHTML);

  
  // Look for React root element
  const reactRoot = await page.$('#root');
  if (reactRoot) {

    const rootContent = await reactRoot.innerHTML();

  } else {

  }
  
  // Check console errors
  page.on('console', msg => {

  });

  // Wait longer to see if content loads with delay
  await page.waitForTimeout(5000);

  
  // Check if content appeared after waiting
  await page.screenshot({ path: 'root-page-after-wait.png' });
  
  // Try to navigate to possible login paths
  const loginPaths = ['/login', '/signin', '/auth', '/auth/login', '/user/login', '/account/login'];
  
  for (const path of loginPaths) {

    await page.goto(path);
    await page.waitForTimeout(1000);
    const url = page.url();

    
    // Check if there are any input elements now
    const inputs = await page.$$('input');

    
    if (inputs.length > 0) {

      await page.screenshot({ path: `login-page-${path.replace('/', '-')}.png` });
      break;
    }
  }
  
  // Try to find login elements using various selectors
  const selectors = [
    'input[type="email"]', 
    'input[type="text"]',
    'input[placeholder*="mail"]',
    'input[placeholder*="user"]',
    'button:has-text("Login")',
    'button:has-text("Sign In")',
    '.login-form',
    '.auth-form',
    'form'
  ];
  
  for (const selector of selectors) {
    const elements = await page.$$(selector);

  }
});