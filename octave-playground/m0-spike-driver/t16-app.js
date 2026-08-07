const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5183/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.screenshot({ path: 't16-initial.png' });

  // wait for kernel ready
  await page.waitForFunction(
    () => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'),
    { timeout: 30000 }
  );
  await page.waitForTimeout(500);
  await page.screenshot({ path: 't16-ready.png' });

  console.log('--- logs ---');
  console.log(logs.slice(-20).join('\n'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
