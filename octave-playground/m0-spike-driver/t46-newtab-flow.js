const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:8899/', { waitUntil: 'load', timeout: 30000 });
  console.log('fake Canvas page loaded, origin:', await page.evaluate(() => window.location.origin));

  // Click the link, exactly as a student would -- opens a genuine new
  // top-level tab (target="_blank"), not an iframe.
  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    page.getByText('Open Unit 1', { exact: false }).click(),
  ]);
  await newPage.waitForLoadState('load', { timeout: 30000 });
  console.log('new tab origin:', await newPage.evaluate(() => window.location.origin));
  console.log('new tab is top-level (window.top === window.self):', await newPage.evaluate(() => window.top === window.self));

  await newPage.getByText('Got it', { exact: true }).click({ timeout: 15000 }).catch(() => {});
  await newPage.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });

  const isolated = await newPage.evaluate(() => window.crossOriginIsolated);
  console.log('crossOriginIsolated in the new tab:', isolated);

  // The actual test: does Run Tests work correctly (the thing that was
  // broken inside a real iframe due to the comlink.worker.js fallback)?
  await newPage.getByText('Run Tests', { exact: true }).click();
  await newPage.waitForFunction(() => /\d+\/\d+/.test(document.body.innerText), null, { timeout: 30000 });
  const bodyText = await newPage.evaluate(() => document.body.innerText);
  const match = bodyText.match(/Score: (\d+)\/(\d+) points/);
  console.log('Run Tests result in new tab:', match ? match[0] : 'NOT FOUND');
  console.log('no filesystem error:', !bodyText.includes('unable to find current directory'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
