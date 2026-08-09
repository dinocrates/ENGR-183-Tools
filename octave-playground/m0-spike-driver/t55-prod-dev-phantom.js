const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground-dev/';

  // --- Scenario 1: no plot, just an unsuppressed statement ---
  await page.goto(base + '?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.getByText('Got it', { exact: true }).click({ timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 5\ndisp('done')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('done'), null, { timeout: 30000 });
  await page.waitForTimeout(500);

  const phantomCount = await page.locator('[title="Close figure"]').count();
  console.log('dev: zero phantom windows for no-plot script:', phantomCount === 0);
  const cmdText = await page.evaluate(() => document.querySelector('pre')?.textContent || '');
  console.log('dev: Command Window shows x = 5:', cmdText.includes('x = 5'));

  // --- Scenario 2: two real plots mixed with unsuppressed statements ---
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 1:0.1:10\ny = sin(x)\nplot(x, y);\nfigure\nz = cos(x)\nplot(x, z);\ndisp('done')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => {
    const spans = Array.from(document.querySelectorAll('span'));
    return spans.some(s => s.textContent === 'Ready');
  }, null, { timeout: 30000 });
  await page.waitForTimeout(2000);

  const figCount = await page.locator('[title="Close figure"]').count();
  const plotCount = await page.locator('.js-plotly-plot').count();
  console.log('dev: exactly 2 figure windows (not more):', figCount === 2);
  console.log('dev: exactly 2 real rendered plots:', plotCount === 2);

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
