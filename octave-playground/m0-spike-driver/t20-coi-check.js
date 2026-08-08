const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('load', () => logs.push('[event] page load'));

  await page.goto('http://localhost:5183/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(10000);
  console.log(logs.join('\n'));
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 200));
  console.log('BODY:', bodyText);
  const isolated = await page.evaluate(() => window.crossOriginIsolated);
  console.log('crossOriginIsolated:', isolated);
  await browser.close();
})();
