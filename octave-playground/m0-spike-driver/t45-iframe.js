const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('[pageerror] ' + e.message));

  await page.goto('http://localhost:8899/', { waitUntil: 'load', timeout: 30000 });
  console.log('outer page origin:', await page.evaluate(() => window.location.origin));

  const frame = page.frameLocator('#playground');
  const frameHandle = await page.$('#playground');
  const contentFrame = await frameHandle.contentFrame();
  console.log('iframe loaded, its origin:', await contentFrame.evaluate(() => window.location.origin));

  // Dismiss the persistence warning inside the iframe
  await frame.getByText('Got it', { exact: true }).click({ timeout: 15000 }).catch(() => console.log('no persistence warning or already dismissed'));

  // Does the kernel actually start inside the iframe?
  await contentFrame.waitForFunction(() => document.body.innerText.includes('Ready') || document.body.innerText.includes("didn't start"), null, { timeout: 60000 });
  const bodyText = await contentFrame.evaluate(() => document.body.innerText);
  console.log('kernel reached Ready inside iframe:', bodyText.includes('Ready'));
  console.log('startup error inside iframe:', bodyText.includes("didn't start"));

  const isolated = await contentFrame.evaluate(() => window.crossOriginIsolated);
  console.log('crossOriginIsolated inside iframe:', isolated);

  console.log('console/page errors inside outer page:', JSON.stringify(consoleErrors.slice(0, 10)));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
