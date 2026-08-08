const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground/';

  await page.goto(base, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);
  let text = await page.evaluate(() => document.body.innerText);
  console.log('prod: shown on first visit:', text.includes('your work lives in this browser'));
  console.log('prod: mentions download buttons:', text.includes('Download File') && text.includes('Download All'));

  await page.mouse.click(50, 50);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  text = await page.evaluate(() => document.body.innerText);
  console.log('prod: not dismissable via backdrop/Escape:', text.includes('your work lives in this browser'));

  await page.getByText('Got it', { exact: true }).click();
  await page.waitForTimeout(200);
  text = await page.evaluate(() => document.body.innerText);
  console.log('prod: dismissed after Got it:', !text.includes('your work lives in this browser'));

  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(500);
  text = await page.evaluate(() => document.body.innerText);
  console.log('prod: does not reappear after acknowledgment:', !text.includes('your work lives in this browser'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
