const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${Date.now()}][${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[${Date.now()}][pageerror] ${e.message}`));
  page.on('framenavigated', (f) => { if (f === page.mainFrame()) logs.push(`[${Date.now()}][nav] ${f.url()}`); });

  await page.goto('https://dinocrates.github.io/ENGR-183-Tools/octave-playground/', { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(10000);

  console.log('isolated:', await page.evaluate(() => window.crossOriginIsolated));
  const swState = await page.evaluate(async () => {
    if (!navigator.serviceWorker) return 'no serviceWorker API';
    const regs = await navigator.serviceWorker.getRegistrations();
    return regs.map(r => ({ scope: r.scope, active: !!r.active, waiting: !!r.waiting, installing: !!r.installing }));
  });
  console.log('SW registrations:', JSON.stringify(swState));

  console.log('=== all logs ===');
  console.log(logs.join('\n'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
