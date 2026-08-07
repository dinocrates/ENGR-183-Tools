const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  await page.goto('http://localhost:5183/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.getByText('Start kernel').click();
  await page.waitForFunction(
    () => document.body.innerText.includes('status: ready') || document.body.innerText.includes('status: error'),
    { timeout: 30000 }
  );
  const afterStart = await page.locator('text=status:').textContent();
  console.log('AFTER START:', afterStart);

  await page.getByText('Run 1+1').click();
  await page.waitForFunction(
    () => document.body.innerText.includes('status: ready') || document.body.innerText.includes('status: error'),
    { timeout: 15000 }
  ).catch(() => {});
  await page.waitForTimeout(1000);

  const afterRun = await page.locator('text=status:').textContent();
  const output = await page.locator('pre').textContent();
  console.log('AFTER RUN:', afterRun);
  console.log('OUTPUT:', JSON.stringify(output));

  console.log('--- console logs ---');
  console.log(logs.join('\n'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
