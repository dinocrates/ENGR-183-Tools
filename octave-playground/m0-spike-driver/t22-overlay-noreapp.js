const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5183/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), { timeout: 30000 });

  // Run Tests against unsolved stubs -- this produces "Error:" text and sets
  // status to 'error' in App.tsx, but should NOT bring back the startup overlay.
  await page.getByText('Run Tests', { exact: true }).click();
  await page.waitForTimeout(3000);

  const overlayBack = await page.evaluate(() => document.body.innerText.includes('Starting Octave') || document.body.innerText.includes("didn't start"));
  console.log('overlay incorrectly reappeared after a run:', overlayBack);

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
