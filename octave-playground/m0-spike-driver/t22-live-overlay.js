const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://dinocrates.github.io/ENGR-183-Tools/octave-playground/', { waitUntil: 'load', timeout: 60000 });

  await page.waitForTimeout(500);
  const overlayEarly = await page.evaluate(() => document.body.innerText.includes('Starting Octave'));
  console.log('overlay visible early:', overlayEarly);

  await page.waitForFunction(() => document.body.innerText.includes('Ready'), { timeout: 60000 });
  await page.waitForTimeout(500);
  const overlayGone = await page.evaluate(() => !document.body.innerText.includes('Starting Octave'));
  console.log('overlay gone after ready:', overlayGone);

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
