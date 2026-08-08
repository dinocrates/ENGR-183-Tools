const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground/';

  // Plot rendering, in a real graded unit
  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("plot([1 2 3],[4 5 6]); xlabel('x'); title('t'); disp('plot done')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('plot done'), null, { timeout: 30000 });
  // plotly.js-dist-min is a ~1.4MB gzipped chunk fetched over the real
  // network here (not local disk like npm run preview), so its dynamic
  // import + render can lag well behind the kernel's own "plot done" text.
  const plotAppeared = await page.waitForSelector('.js-plotly-plot', { timeout: 20000 }).then(() => true).catch(() => false);
  console.log('prod: plot renders in a graded unit:', plotAppeared);

  // Scratch Pad
  await page.goto(base, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);
  let text = await page.evaluate(() => document.body.innerText);
  console.log('prod: index shows Scratch Pad:', text.includes('Scratch Pad'));

  await page.getByText('Scratch Pad', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });
  console.log('prod: scratch URL:', page.url());
  text = await page.evaluate(() => document.body.innerText);
  console.log('prod: Run Tests hidden in scratch:', !text.includes('Run Tests'));

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 1:0.1:10; plot(x, sin(x)); disp('scratch run ok')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('scratch run ok'), null, { timeout: 30000 });
  const scratchPlotAppeared = await page.waitForSelector('.js-plotly-plot', { timeout: 20000 }).then(() => true).catch(() => false);
  console.log('prod: plot renders in scratch pad:', scratchPlotAppeared);

  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });
  await page.waitForTimeout(500);
  const modelValues = await page.evaluate(() => (window.monaco?.editor.getModels() ?? []).map((m) => m.getValue()));
  console.log('prod: scratch edit persisted across reload:', modelValues.some((v) => v.includes('scratch run ok')));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
