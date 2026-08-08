const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Fresh browser context, deep-link straight into a unit (skips the index entirely)
  await page.goto('http://localhost:5183/?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);
  let text = await page.evaluate(() => document.body.innerText);
  console.log('shown on first visit via deep link:', text.includes('your work lives in this browser'));
  console.log('Starting Octave overlay also present underneath:', text.includes('Starting Octave'));

  const zOrder = await page.evaluate(() => {
    const warning = Array.from(document.querySelectorAll('div')).find(d => d.textContent.includes('your work lives in this browser'))?.closest('.fixed');
    return warning ? getComputedStyle(warning).zIndex : null;
  });
  console.log('persistence warning z-index:', zOrder);

  await page.getByText('Got it', { exact: true }).click();
  await page.waitForTimeout(300);
  text = await page.evaluate(() => document.body.innerText);
  console.log('dismissed, kernel still starting/started underneath:', !text.includes('your work lives in this browser'));

  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });
  console.log('kernel reaches Ready normally after dismissal:', true);

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
