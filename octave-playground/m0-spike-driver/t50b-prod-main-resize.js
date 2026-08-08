const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground/';

  await page.goto(base + '?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.getByText('Got it', { exact: true }).click({ timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 1:0.1:10; plot(x, sin(x)); disp('done')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('done'), null, { timeout: 30000 });
  await page.waitForSelector('.js-plotly-plot', { timeout: 20000 });
  await page.waitForTimeout(500);

  const closeBtn = page.locator('[title="Close figure"]');
  const figWindow = closeBtn.locator('xpath=../../..');
  const before = await figWindow.boundingBox();

  // Resize
  const handle = page.locator('[title="Resize"]');
  const handleBox = await handle.boundingBox();
  await page.mouse.move(handleBox.x + 8, handleBox.y + 8);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 8 + 150, handleBox.y + 8 + 100, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const after = await figWindow.boundingBox();
  console.log('prod: resize grew window:', after.width > before.width + 100 && after.height > before.height + 50);
  const plotBox = await page.locator('.js-plotly-plot').boundingBox();
  console.log('prod: plot resized to match window:', Math.abs(plotBox.width - after.width) < 20);

  // Minimize
  await page.locator('[title="Minimize figure"]').click();
  await page.waitForTimeout(300);
  const minimizedBox = await figWindow.boundingBox();
  console.log('prod: window collapsed on minimize:', minimizedBox.height < 50);
  console.log('prod: plot unmounted while minimized:', (await page.locator('.js-plotly-plot').count()) === 0);

  // Expand
  const expandBtn = page.locator('[title="Expand figure"]');
  console.log('prod: expand button present:', (await expandBtn.count()) === 1);
  await expandBtn.click();
  await page.waitForTimeout(500);
  const expandedBox = await figWindow.boundingBox();
  console.log('prod: window restored on expand:', expandedBox.height > 200);
  console.log('prod: plot re-rendered after expand:', (await page.locator('.js-plotly-plot').count()) === 1);

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
