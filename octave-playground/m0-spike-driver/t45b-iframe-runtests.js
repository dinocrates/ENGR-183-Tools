const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://localhost:8899/', { waitUntil: 'load', timeout: 30000 });
  const frameHandle = await page.$('#playground');
  const contentFrame = await frameHandle.contentFrame();
  const frame = page.frameLocator('#playground');

  await frame.getByText('Got it', { exact: true }).click({ timeout: 15000 }).catch(() => {});
  await contentFrame.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });

  const isolated = await contentFrame.evaluate(() => window.crossOriginIsolated);
  console.log('crossOriginIsolated inside iframe:', isolated);

  // Actually run tests -- this is what M1 found broken under the
  // comlink.worker.js fallback (filesystem/cwd operations), which is what
  // gets used when crossOriginIsolated is false.
  await frame.getByText('Run Tests', { exact: true }).click();
  await contentFrame.waitForFunction(() => /\d+\/\d+/.test(document.body.innerText) || document.body.innerText.includes('Error') || document.body.innerText.includes('exception'), null, { timeout: 30000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 1500));
  const commandWindowText = await contentFrame.evaluate(() => {
    const cw = Array.from(document.querySelectorAll('div')).find((d) => d.textContent === 'Command Window');
    return cw?.parentElement?.textContent ?? 'NOT FOUND';
  });
  console.log('Command Window after Run Tests inside iframe:', commandWindowText.slice(0, 500));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
