const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1')); // T3.4: skip the first-visit warning, not what this script tests

  await page.goto('http://localhost:5183/?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  // Edit the active file (addTwo.m)
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("function s = addTwo(a, b)\n  s = a + b; % MY EDIT MARKER\nend");
  await page.waitForTimeout(700); // let autosave debounce fire

  let modelValues = await page.evaluate(() => (window.monaco?.editor.getModels() ?? []).map((m) => m.getValue()));
  console.log('editor shows my edit before reset:', modelValues.some((v) => v.includes('MY EDIT MARKER')));

  // Reset File: click, expect confirm dialog, cancel first to verify cancel works
  await page.getByText('Reset File', { exact: true }).click();
  let dialogText = await page.evaluate(() => document.body.innerText);
  console.log('confirm dialog shows filename:', dialogText.includes('Reset addTwo.m?'));
  await page.getByText('Cancel', { exact: true }).click();
  await page.waitForTimeout(200);
  modelValues = await page.evaluate(() => (window.monaco?.editor.getModels() ?? []).map((m) => m.getValue()));
  console.log('edit still present after Cancel:', modelValues.some((v) => v.includes('MY EDIT MARKER')));

  // Now actually confirm the reset
  await page.getByText('Reset File', { exact: true }).click();
  await page.getByText('Reset file', { exact: true }).click();
  await page.waitForTimeout(500);
  modelValues = await page.evaluate(() => (window.monaco?.editor.getModels() ?? []).map((m) => m.getValue()));
  console.log('edit gone after confirming reset:', !modelValues.some((v) => v.includes('MY EDIT MARKER')));
  console.log('restored to starter content:', modelValues.some((v) => v.includes('not implemented yet')));

  // Other files (circleArea.m, greet.m) should be untouched -- edit greet.m too, then Reset File on addTwo shouldn't touch it
  await page.locator('button', { hasText: 'greet.m' }).first().click();
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("function s = greet(name)\n  s = ['hi ' name]; % GREET EDIT\nend");
  await page.waitForTimeout(700);
  await page.locator('button', { hasText: 'addTwo.m' }).first().click();
  await page.getByText('Reset File', { exact: true }).click();
  await page.getByText('Reset file', { exact: true }).click();
  await page.waitForTimeout(500);
  await page.locator('button', { hasText: 'greet.m' }).first().click();
  modelValues = await page.evaluate(() => (window.monaco?.editor.getModels() ?? []).map((m) => m.getValue()));
  console.log('greet.m edit untouched by addTwo.m reset:', modelValues.some((v) => v.includes('GREET EDIT')));

  // Reset Unit: should reset greet.m too now
  await page.locator('button[title*="every file"]').click();
  dialogText = await page.evaluate(() => document.body.innerText);
  console.log('unit confirm dialog names all files:', dialogText.includes('addTwo.m') && dialogText.includes('circleArea.m') && dialogText.includes('greet.m'));
  await page.locator('button.bg-red-600', { hasText: 'Reset unit' }).click();
  await page.waitForTimeout(1000);
  modelValues = await page.evaluate(() => (window.monaco?.editor.getModels() ?? []).map((m) => m.getValue()));
  console.log('greet.m reset by Reset Unit:', !modelValues.some((v) => v.includes('GREET EDIT')));

  // Verify persistence: reload and confirm reset survived
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });
  await page.waitForTimeout(500);
  modelValues = await page.evaluate(() => (window.monaco?.editor.getModels() ?? []).map((m) => m.getValue()));
  console.log('reset persisted across reload:', modelValues.some((v) => v.includes('not implemented yet')) && !modelValues.some((v) => v.includes('GREET EDIT')));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
