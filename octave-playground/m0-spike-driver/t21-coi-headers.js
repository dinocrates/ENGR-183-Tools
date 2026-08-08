const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  const respHeaders = [];
  page.on('response', (res) => {
    if (res.url().includes('octave-playground/') && (res.url().endsWith('/') || res.url().endsWith('.js') || res.url().endsWith('.html'))) {
      respHeaders.push(`${res.url()} coop=${res.headers()['cross-origin-opener-policy'] || 'none'} coep=${res.headers()['cross-origin-embedder-policy'] || 'none'}`);
    }
  });

  await page.goto('https://dinocrates.github.io/ENGR-183-Tools/octave-playground/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(6000);

  console.log('controller:', await page.evaluate(() => !!navigator.serviceWorker.controller));
  console.log('isolated:', await page.evaluate(() => window.crossOriginIsolated));
  console.log('--- response headers seen ---');
  console.log(respHeaders.join('\n'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
