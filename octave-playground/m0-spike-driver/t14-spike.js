const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));

  await page.goto('http://localhost:5183/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1000);

  await page.getByText('Start kernel').click();
  await page.waitForTimeout(500);

  // wait up to 60s for status to become ready or error
  await page.waitForFunction(
    () => {
      const el = document.body.innerText;
      return el.includes('status: ready') || el.includes('status: error');
    },
    { timeout: 60000 }
  ).catch(() => {});

  const statusText = await page.locator('text=status:').textContent().catch(() => 'N/A');
  console.log('STATUS:', statusText);

  const outputText = await page.locator('pre').textContent().catch(() => '');
  console.log('OUTPUT:', outputText);

  console.log('--- console logs (last 40) ---');
  console.log(logs.slice(-40).join('\n'));

  await page.screenshot({ path: 't14-spike.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
