// e2e-tests/auth/element-inspector.spec.js
const { test } = require('@playwright/test');

test('inspect login page elements', async ({ page }) => {
  // Go to the root where the login page is
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  
  // Take a screenshot of the page
  await page.screenshot({ path: 'login-page-full.png' });
  
  // Analyze the input elements in detail
  const inputs = await page.$$('input');

  
  for (let i = 0; i < inputs.length; i++) {
    // For each input, get detailed information
    const details = await inputs[i].evaluate(el => ({
      id: el.id,
      name: el.name,
      type: el.type,
      placeholder: el.placeholder,
      value: el.value,
      classList: Array.from(el.classList),
      parent: el.parentElement ? {
        tagName: el.parentElement.tagName,
        classList: Array.from(el.parentElement.classList)
      } : null
    }));
    

  }
  
  // Find all clickable elements (buttons, divs that look like buttons)
  const clickables = await page.$$('button, .submit, [role="button"], a');

  
  for (let i = 0; i < clickables.length; i++) {
    const details = await clickables[i].evaluate(el => ({
      tagName: el.tagName,
      id: el.id,
      textContent: el.textContent.trim(),
      classList: Array.from(el.classList),
      parent: el.parentElement ? {
        tagName: el.parentElement.tagName,
        classList: Array.from(el.parentElement.classList)
      } : null
    }));
    

  }
  
  // Wait so we can see the page in headed mode
  await page.waitForTimeout(3000);
});