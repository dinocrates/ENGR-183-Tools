const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5183/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), { timeout: 30000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 't23-problem-statement.png' });
  console.log('screenshot saved');
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
