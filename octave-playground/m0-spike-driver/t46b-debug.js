const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto('http://localhost:8899/', { waitUntil: 'load', timeout: 30000 });
  const [newPage] = await Promise.all([
    context.waitForEvent('page'),
    page.getByText('Open Unit 1', { exact: false }).click(),
  ]);
  await newPage.waitForLoadState('load', { timeout: 30000 });
  await newPage.getByText('Got it', { exact: true }).click({ timeout: 15000 }).catch(() => {});
  await newPage.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });

  await newPage.getByText('Run Tests', { exact: true }).click();
  await newPage.waitForTimeout(3000);
  const commandWindowText = await newPage.evaluate(() => {
    const cw = Array.from(document.querySelectorAll('div')).find((d) => d.textContent === 'Command Window');
    return cw?.parentElement?.textContent ?? 'NOT FOUND';
  });
  console.log('Command Window full text:', commandWindowText);

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
