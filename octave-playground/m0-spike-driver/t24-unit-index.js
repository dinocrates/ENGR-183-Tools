const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5183/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);

  const indexText = await page.evaluate(() => document.body.innerText);
  console.log('shows index with unit01:', indexText.includes('Unit 1') && indexText.includes('Pick a unit'));
  await page.screenshot({ path: 't24-index.png' });

  await page.getByText('Unit 1 — Getting Started', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 30000 });
  console.log('URL after selecting unit:', page.url());
  await page.screenshot({ path: 't24-playground.png' });

  await page.getByText('← All units', { exact: true }).click();
  await page.waitForTimeout(300);
  const backAtIndex = await page.evaluate(() => document.body.innerText.includes('Pick a unit'));
  console.log('back button returns to index:', backAtIndex);
  console.log('URL after back:', page.url());

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
