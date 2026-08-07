const { chromium } = require('playwright');

async function measure(label, throttle) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  let totalBytes = 0;
  let readyTime = null;
  const start = Date.now();

  page.on('response', async (res) => {
    try {
      const headers = res.headers();
      const len = headers['content-length'];
      if (len) totalBytes += parseInt(len, 10);
    } catch (e) {}
  });
  page.on('console', (msg) => {
    if (msg.text().includes('Octave is ready!') && readyTime === null) {
      readyTime = Date.now() - start;
    }
  });

  if (throttle) {
    const client = await context.newCDPSession(page);
    await client.send('Network.enable');
    // "Fast 3G" per Chrome DevTools presets
    await client.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: (1.6 * 1024 * 1024) / 8,
      uploadThroughput: (750 * 1024) / 8,
      latency: 150,
    });
  }

  await page.goto('http://localhost:8000/repl/index.html?kernel=xoctave&toolbar=1', {
    waitUntil: 'load',
    timeout: 180000,
  });

  // wait up to 3 minutes for "Octave is ready!"
  const deadline = Date.now() + 180000;
  while (readyTime === null && Date.now() < deadline) {
    await page.waitForTimeout(500);
  }

  console.log(`[${label}] totalBytes=${totalBytes} (${(totalBytes/1024/1024).toFixed(1)} MiB), timeToReady=${readyTime}ms`);
  await browser.close();
}

(async () => {
  await measure('desktop-broadband', false);
  await measure('fast-3g', true);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
