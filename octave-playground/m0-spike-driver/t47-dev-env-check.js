const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground-dev/';

  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.getByText('Got it', { exact: true }).click({ timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });
  console.log('dev env: kernel reached Ready:', true);

  const isolated = await page.evaluate(() => window.crossOriginIsolated);
  console.log('dev env: crossOriginIsolated:', isolated);

  await page.getByText('Run Tests', { exact: true }).click();
  await page.waitForFunction(() => /Score: \d+\/30/.test(document.body.innerText), null, { timeout: 30000 });
  const bodyText = await page.evaluate(() => document.body.innerText);
  const match = bodyText.match(/Score: \d+\/30 points/);
  console.log('dev env: Run Tests result:', match ? match[0] : 'NOT FOUND');
  console.log('dev env: no filesystem error:', !bodyText.includes('unable to find current directory'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
