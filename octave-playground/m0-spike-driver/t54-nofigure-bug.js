const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));

  await page.goto('http://localhost:5183/?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  // No plot() call at all -- just a bare unsuppressed statement, extremely common code
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 5\ndisp('done')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('done'), null, { timeout: 30000 });
  await page.waitForTimeout(800);

  const figureWindowCount = await page.locator('[title="Close figure"]').count();
  console.log('BUG 1 CHECK: figure windows present with NO plot() call:', figureWindowCount);

  await page.screenshot({ path: 't54-nofig.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
