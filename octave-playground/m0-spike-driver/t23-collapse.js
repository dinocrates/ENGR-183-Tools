const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5183/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), { timeout: 30000 });

  const before = await page.evaluate(() => document.body.innerText.includes('deliberately easy'));
  await page.getByText('Hide', { exact: true }).click();
  await page.waitForTimeout(200);
  const afterHide = await page.evaluate(() => document.body.innerText.includes('deliberately easy'));
  await page.getByText('Show', { exact: true }).click();
  await page.waitForTimeout(200);
  const afterShow = await page.evaluate(() => document.body.innerText.includes('deliberately easy'));

  console.log('visible before:', before, '| hidden after Hide:', !afterHide, '| visible after Show:', afterShow);
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
