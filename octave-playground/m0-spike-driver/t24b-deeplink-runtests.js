const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Deep link directly to unit01
  await page.goto('http://localhost:5183/?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), { timeout: 30000 });
  const text1 = await page.evaluate(() => document.body.innerText);
  console.log('deep link skips index, shows playground:', !text1.includes('Pick a unit'));
  console.log('URL stayed at ?unit=unit01:', page.url());

  // Run Tests through the new Playground component
  await page.getByText('Run Tests', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('/30'), { timeout: 30000 });
  const text2 = await page.evaluate(() => document.body.innerText);
  const match = text2.match(/(\d+)\/(\d+)/);
  console.log('Run Tests result:', match ? match[0] : 'NOT FOUND');

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
