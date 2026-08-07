const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5183/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.getByText('Start kernel').click();
  await page.waitForFunction(() => document.body.innerText.includes('status: ready'), { timeout: 30000 });
  await page.getByText('Run harness (write-then-run smoke test)').click();
  await page.waitForTimeout(3000);
  const output = await page.locator('pre').textContent();
  console.log(output);
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
