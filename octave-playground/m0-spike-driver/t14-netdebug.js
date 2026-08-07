const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const suspicious = [];
  page.on('response', async (res) => {
    const url = res.url();
    const ct = res.headers()['content-type'] || '';
    if (ct.includes('text/html') && !url.endsWith('/') && !url.endsWith('index.html')) {
      suspicious.push(`SUSPICIOUS(html-fallback) ${res.status()} ${url}`);
    }
  });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  page.on('console', (m) => { if (m.type() === 'log') console.log('[log]', m.text()); });

  await page.goto('http://localhost:5183/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.getByText('Start kernel').click();
  await page.waitForTimeout(10000);

  console.log('--- suspicious (HTML served for non-html request) ---');
  console.log(suspicious.join('\n'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
