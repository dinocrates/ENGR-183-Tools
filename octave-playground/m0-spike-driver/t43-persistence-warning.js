const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Fresh visit: index page
  await page.goto('http://localhost:5183/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);
  let text = await page.evaluate(() => document.body.innerText);
  console.log('shown on first visit (index):', text.includes('your work lives in this browser'));
  console.log('mentions Download File/Download All:', text.includes('Download File') && text.includes('Download All'));

  // Try clicking outside the dialog (on the backdrop) -- should NOT dismiss it
  await page.mouse.click(50, 50);
  await page.waitForTimeout(200);
  text = await page.evaluate(() => document.body.innerText);
  console.log('backdrop click does not dismiss it:', text.includes('your work lives in this browser'));

  // Try Escape -- should NOT dismiss it either (no keydown handler wired)
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  text = await page.evaluate(() => document.body.innerText);
  console.log('Escape does not dismiss it:', text.includes('your work lives in this browser'));

  // Click "Got it" -- should dismiss and reveal the index underneath
  await page.getByText('Got it', { exact: true }).click();
  await page.waitForTimeout(200);
  text = await page.evaluate(() => document.body.innerText);
  console.log('dismissed after Got it:', !text.includes('your work lives in this browser'));
  console.log('index visible underneath:', text.includes('Pick a unit'));

  // Reload -- should NOT show again (acknowledged, persisted via localStorage)
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  text = await page.evaluate(() => document.body.innerText);
  console.log('does not reappear after reload (already acknowledged):', !text.includes('your work lives in this browser'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
