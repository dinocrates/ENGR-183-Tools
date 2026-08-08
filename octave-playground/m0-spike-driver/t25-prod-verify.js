const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground/';

  await page.goto(base, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(1000);
  let text = await page.evaluate(() => document.body.innerText);
  console.log('prod index shows unit list:', text.includes('Unit 1') && text.includes('Pick a unit'));

  await page.getByText('Unit 1 — Getting Started', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready') || document.body.innerText.includes("didn't start"), null, { timeout: 60000 });
  console.log('prod URL after select:', page.url());
  text = await page.evaluate(() => document.body.innerText);
  console.log('prod kernel ready:', text.includes('Ready'));

  await page.getByText('← All units', { exact: true }).click();
  await page.waitForTimeout(500);
  text = await page.evaluate(() => document.body.innerText);
  console.log('prod back-to-index works:', text.includes('Pick a unit'));

  // deep link
  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready') || document.body.innerText.includes("didn't start"), null, { timeout: 60000 });
  text = await page.evaluate(() => document.body.innerText);
  console.log('prod deep link skips index:', !text.includes('Pick a unit'));
  console.log('prod deep link kernel ready:', text.includes('Ready'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
