const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  // Scratch Pad, not a graded unit: its plain script has top-level
  // assignments, unlike a graded unit's function files, which run() without
  // populating any base-workspace variables at all (correctly empty, same
  // as real Octave calling a function that isn't itself a script).
  await page.goto('http://localhost:5183/?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  let text = await page.evaluate(() => document.body.innerText);
  console.log('Workspace panel present:', text.includes('Workspace'));
  console.log('Workspace initially empty:', text.includes('No variables'));

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 1:0.1:10; y = sin(x); name = 'hello'; plot(x, y); disp('done')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('done'), null, { timeout: 30000 });
  await page.waitForSelector('.js-plotly-plot', { timeout: 20000 });
  await page.waitForTimeout(500);

  text = await page.evaluate(() => document.body.innerText);
  console.log('workspace shows x:', /\bx\b/.test(text));
  console.log('workspace shows y:', /\by\b/.test(text));
  console.log('workspace shows name:', text.includes('name'));
  // plot(x, y) called as a bare statement (unassigned) auto-assigns its
  // graphics-handle return to `ans` -- authentic Octave behavior, not a bug.
  console.log('workspace shows auto-assigned ans:', /\bans\b/.test(text));
  console.log('workspace does NOT show internal fid bookkeeping var:', !text.includes('fid'));

  // Graded unit: function files only, run() shouldn't populate anything.
  await page.goto('http://localhost:5183/?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForTimeout(1500);
  text = await page.evaluate(() => document.body.innerText);
  console.log('workspace stays empty for a graded (function-file) unit:', text.includes('No variables'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
