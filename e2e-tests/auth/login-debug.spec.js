// e2e-tests/auth/login-debug.spec.js
const { test, expect } = require('@playwright/test');

test('diagnose login page elements', async ({ page }) => {
  // Try root URL
  await page.goto('/');
  console.log('Current URL after going to root:', page.url());
  
  // Take screenshot to see what's on the page
  await page.screenshot({ path: 'root-page.png' });
  
  // Examine the HTML structure
  const rootHtml = await page.evaluate(() => document.documentElement.outerHTML);
  console.log('Root page HTML sample:', rootHtml.substring(0, 300));
  
  // Look for React root element
  const reactRoot = await page.$('#root');
  if (reactRoot) {
    console.log('React root element found');
    const rootContent = await reactRoot.innerHTML();
    console.log('React root content sample:', rootContent.substring(0, 100));
  } else {
    console.log('No React root element found');
  }
  
  // Check console errors
  page.on('console', msg => {
    console.log(`Browser console ${msg.type()}: ${msg.text()}`);
  });

  // Wait longer to see if content loads with delay
  await page.waitForTimeout(5000);
  console.log('After waiting 5 seconds...');
  
  // Check if content appeared after waiting
  await page.screenshot({ path: 'root-page-after-wait.png' });
  
  // Try to navigate to possible login paths
  const loginPaths = ['/login', '/signin', '/auth', '/auth/login', '/user/login', '/account/login'];
  
  for (const path of loginPaths) {
    console.log(`Trying path: ${path}`);
    await page.goto(path);
    await page.waitForTimeout(1000);
    const url = page.url();
    console.log(`Current URL: ${url}`);
    
    // Check if there are any input elements now
    const inputs = await page.$$('input');
    console.log(`Number of input elements at ${path}: ${inputs.length}`);
    
    if (inputs.length > 0) {
      console.log('Found input elements, saving screenshot');
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
    console.log(`Selector "${selector}" found ${elements.length} elements`);
  }
});