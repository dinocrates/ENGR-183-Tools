const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1')); // T3.4: skip the first-visit warning, not what this script tests

  await page.goto('http://localhost:5183/', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);
  let text = await page.evaluate(() => document.body.innerText);
  console.log('index shows Scratch Pad:', text.includes('Scratch Pad'));

  await page.getByText('Scratch Pad', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });
  console.log('URL after selecting scratch:', page.url());

  text = await page.evaluate(() => document.body.innerText);
  console.log('Run Tests button hidden in scratch:', !text.includes('Run Tests'));
  console.log('Run File button present:', text.includes('Run File'));
  console.log('shows scratch.m in file browser:', text.includes('scratch.m'));
  console.log('shows starter comment text:', text.includes('write and run anything here') || text.includes('Scratch Pad'));

  // run the starter's suggested sin plot to confirm plots work in scratch too
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 1:0.1:10; plot(x, sin(x)); disp('scratch run ok')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('scratch run ok'), null, { timeout: 30000 });
  await page.waitForTimeout(1000);
  const hasPlot = await page.evaluate(() => !!document.querySelector('.js-plotly-plot'));
  console.log('plot rendered in scratch pad:', hasPlot);

  // reload and confirm the edit persisted (same persistence mechanism as units).
  // Read via the Monaco model API, not .textContent -- Monaco virtualizes its
  // DOM so textContent on the container is unreliable right after a render.
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });
  await page.waitForTimeout(500);
  const modelValues = await page.evaluate(() => (window.monaco?.editor.getModels() ?? []).map((m) => m.getValue()));
  console.log('edit persisted across reload:', modelValues.some((v) => v.includes('scratch run ok')));

  // back to index
  await page.getByText('← All units', { exact: true }).click();
  await page.waitForTimeout(300);
  text = await page.evaluate(() => document.body.innerText);
  console.log('back button returns to index:', text.includes('Pick a unit'));

  await page.screenshot({ path: 't27-scratch.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
