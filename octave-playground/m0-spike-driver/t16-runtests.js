const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5183/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), { timeout: 30000 });

  await page.getByText('Run Tests', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'), { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 't16-runtests-unsolved.png' });

  const output = await page.locator('pre').textContent();
  console.log('=== unsolved run ===');
  console.log(output);

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
