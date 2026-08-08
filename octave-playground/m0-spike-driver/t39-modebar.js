const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.goto('http://localhost:5183/?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 1:0.1:10; plot(x, sin(x)); disp('done')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('done'), null, { timeout: 30000 });
  await page.waitForSelector('.js-plotly-plot', { timeout: 20000 });

  // Move mouse away from the plot -- if the modebar is still visible without
  // hovering, the fix worked.
  await page.mouse.move(50, 780);
  await page.waitForTimeout(800);

  const modebarVisible = await page.evaluate(() => {
    const modebar = document.querySelector('.modebar');
    if (!modebar) return { found: false };
    const style = getComputedStyle(modebar);
    const rect = modebar.getBoundingClientRect();
    return { found: true, display: style.display, opacity: style.opacity, visible: rect.width > 0 && rect.height > 0 && style.display !== 'none' && parseFloat(style.opacity) > 0 };
  });
  console.log('modebar visible without hover:', JSON.stringify(modebarVisible));

  await page.screenshot({ path: 't39-modebar.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
