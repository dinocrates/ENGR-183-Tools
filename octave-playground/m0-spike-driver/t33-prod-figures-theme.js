const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground/';

  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("plot([1 2 3],[4 5 6]); disp('done one'); figure; plot([3 2 1],[1 2 3]); disp('done two')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('done two'), null, { timeout: 30000 });
  await page.waitForSelector('.js-plotly-plot', { timeout: 20000 });
  await page.waitForTimeout(500);

  const figureCount = await page.evaluate(() => document.querySelectorAll('.js-plotly-plot').length);
  console.log('prod: two floating figure windows:', figureCount === 2);

  // Query the <pre> output directly -- PanelHeader (T3.10's resizable panes)
  // wraps the "Command Window" label in a <span> alongside a collapse
  // button, so the header div's own textContent is no longer an exact match.
  const commandWindowText = await page.evaluate(() => document.querySelector('pre')?.textContent ?? '');
  console.log('prod: plots not inline in command window:', !commandWindowText.includes('scatter'));
  console.log('prod: command window shows text output:', commandWindowText.includes('done one') && commandWindowText.includes('done two'));

  const closeButtons = page.locator('[title="Close figure"]');
  const before = await page.evaluate(() => document.querySelectorAll('.js-plotly-plot').length);
  await closeButtons.first().click();
  await page.waitForTimeout(300);
  const after = await page.evaluate(() => document.querySelectorAll('.js-plotly-plot').length);
  console.log('prod: closing a figure works:', after === before - 1);

  const titleBarText = await page.evaluate(() => document.body.innerText);
  console.log('prod: app title bar present:', titleBarText.includes('ENGR-183 Octave Playground') && titleBarText.includes('Unit 1'));

  await page.screenshot({ path: 't33-prod.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
