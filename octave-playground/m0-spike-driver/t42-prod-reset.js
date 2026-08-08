const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground/';

  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("function s = addTwo(a, b)\n  s = a + b; % MY EDIT MARKER\nend");
  await page.waitForTimeout(700);

  await page.getByText('Reset File', { exact: true }).click();
  const dialogText = await page.evaluate(() => document.body.innerText);
  console.log('prod: confirm dialog names file:', dialogText.includes('Reset addTwo.m?'));
  await page.getByText('Reset file', { exact: true }).click();
  await page.waitForTimeout(500);

  const modelValues = await page.evaluate(() => (window.monaco?.editor.getModels() ?? []).map((m) => m.getValue()));
  console.log('prod: edit gone after reset:', !modelValues.some((v) => v.includes('MY EDIT MARKER')));
  console.log('prod: restored to starter:', modelValues.some((v) => v.includes('not implemented yet')));

  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });
  await page.waitForTimeout(500);
  const afterReload = await page.evaluate(() => (window.monaco?.editor.getModels() ?? []).map((m) => m.getValue()));
  console.log('prod: reset persisted across reload:', afterReload.some((v) => v.includes('not implemented yet')));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
