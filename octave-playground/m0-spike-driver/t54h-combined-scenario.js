const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));

  await page.goto('http://localhost:5183/?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  // Realistic messy beginner code: unsuppressed assignments mixed with two plots
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 1:0.1:10\ny = sin(x)\nplot(x, y);\nfigure\nz = cos(x)\nplot(x, z);\ndisp('done')");
  await page.getByText('Run File', { exact: true }).click();

  await page.waitForFunction(() => {
    const spans = Array.from(document.querySelectorAll('span'));
    return spans.some(s => s.textContent === 'Ready');
  }, null, { timeout: 30000 });
  await page.waitForTimeout(2000);

  const figWindows = await page.locator('[title="Close figure"]').count();
  console.log('figure windows (should be exactly 2, not more):', figWindows);
  const realPlots = await page.locator('.js-plotly-plot').count();
  console.log('real rendered plots (should be 2):', realPlots);
  const labels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[title="Close figure"]')).map(
      (btn) => btn.parentElement?.parentElement?.querySelector('span')?.textContent,
    ),
  );
  console.log('labels:', JSON.stringify(labels));

  const cmdWindowText = await page.evaluate(() => document.querySelector('pre')?.textContent || '');
  console.log('command window shows x/y/z unsuppressed output:', cmdWindowText.includes('x =') && cmdWindowText.includes('y =') && cmdWindowText.includes('z ='));
  console.log('command window shows done:', cmdWindowText.includes('done'));

  await page.screenshot({ path: 't54h-result.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
