const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));

  await page.goto('http://localhost:5183/?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 1:0.1:10; plot(x, sin(x)); disp('done')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('done'), null, { timeout: 30000 });
  await page.waitForSelector('.js-plotly-plot', { timeout: 20000 });
  await page.waitForTimeout(500);

  // --- RESIZE ---
  const closeBtn = page.locator('[title="Close figure"]');
  const figWindow = closeBtn.locator('xpath=../../..');
  const before = await figWindow.boundingBox();
  console.log('initial size:', JSON.stringify({ w: Math.round(before.width), h: Math.round(before.height) }));

  const handle = page.locator('[title="Resize"]');
  const handleBox = await handle.boundingBox();
  await page.mouse.move(handleBox.x + 8, handleBox.y + 8);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + 8 + 150, handleBox.y + 8 + 100, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);

  const after = await figWindow.boundingBox();
  console.log('size after resize:', JSON.stringify({ w: Math.round(after.width), h: Math.round(after.height) }));
  console.log('window grew correctly:', after.width > before.width + 100 && after.height > before.height + 50);

  // plot should have redrawn at the new size
  const plotBox = await page.locator('.js-plotly-plot').boundingBox();
  console.log('plot resized to roughly match window:', Math.abs(plotBox.width - after.width) < 20);

  // Min size clamp: try to shrink way below MIN_SIZE
  await page.mouse.move(handleBox.x + 8 + 150, handleBox.y + 8 + 100);
  await page.mouse.down();
  await page.mouse.move(handleBox.x - 500, handleBox.y - 500, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(500);
  const shrunk = await figWindow.boundingBox();
  console.log('min size clamp respected (w>=320, h>=220ish):', shrunk.width >= 315 && shrunk.height >= 215);

  // --- MINIMIZE / EXPAND ---
  const minimizeBtn = page.locator('[title="Minimize figure"]');
  await minimizeBtn.click();
  await page.waitForTimeout(300);
  const minimizedBox = await figWindow.boundingBox();
  console.log('window collapsed when minimized (much shorter):', minimizedBox.height < 50);
  const plotVisibleWhileMinimized = await page.locator('.js-plotly-plot').count();
  console.log('plot content hidden while minimized:', plotVisibleWhileMinimized === 0);

  const expandBtn = page.locator('[title="Expand figure"]');
  const expandBtnCount = await expandBtn.count();
  console.log('expand button appears once minimized:', expandBtnCount === 1);
  await expandBtn.click();
  await page.waitForTimeout(500);
  const expandedBox = await figWindow.boundingBox();
  console.log('window restored on expand:', expandedBox.height > 200);
  const plotVisibleAfterExpand = await page.locator('.js-plotly-plot').count();
  console.log('plot re-rendered after expand:', plotVisibleAfterExpand === 1);

  await page.screenshot({ path: 't49-result.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
