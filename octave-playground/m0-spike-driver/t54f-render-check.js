const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));

  await page.goto('http://localhost:5183/?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 1:0.1:10;\nplot(x, sin(x));\nfigure;\nplot(x, cos(x));\ndisp('done')");
  await page.getByText('Run File', { exact: true }).click();

  // Wait for full completion (status back to Ready), THEN extra time for
  // both figures' async Plotly dynamic-import + newPlot to finish.
  await page.waitForFunction(() => {
    const spans = Array.from(document.querySelectorAll('span'));
    return spans.some(s => s.textContent === 'Ready');
  }, null, { timeout: 30000 });
  await page.waitForTimeout(2000);

  const realPlots = await page.locator('.js-plotly-plot').count();
  console.log('real rendered plots after full wait:', realPlots);
  const figWindows = await page.locator('[title="Close figure"]').count();
  console.log('figure windows:', figWindows);

  await page.screenshot({ path: 't54f-result.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
