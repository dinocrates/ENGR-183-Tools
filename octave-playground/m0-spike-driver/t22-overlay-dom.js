const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5183/', { waitUntil: 'load', timeout: 30000 });

  await page.waitForTimeout(300);
  const overlayVisible = await page.evaluate(() => document.body.innerText.includes('Starting Octave'));
  console.log('overlay visible early:', overlayVisible);

  await page.waitForFunction(() => document.body.innerText.includes('Ready'), { timeout: 30000 });
  await page.waitForTimeout(300);
  const overlayGone = await page.evaluate(() => !document.body.innerText.includes('Starting Octave'));
  console.log('overlay gone after ready:', overlayGone);

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
