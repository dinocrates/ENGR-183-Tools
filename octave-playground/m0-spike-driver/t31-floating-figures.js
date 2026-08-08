const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1')); // T3.4: skip the first-visit warning, not what this script tests

  await page.goto('http://localhost:5183/?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  // No plot yet -- should NOT be in the Command Window's inline flow anymore
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("plot([1 2 3],[4 5 6]); disp('done one'); figure; plot([3 2 1],[1 2 3]); disp('done two')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('done two'), null, { timeout: 30000 });
  await page.waitForSelector('.js-plotly-plot', { timeout: 20000 });
  await page.waitForTimeout(500);

  const figureCount = await page.evaluate(() => document.querySelectorAll('.js-plotly-plot').length);
  console.log('number of floating figure windows:', figureCount);

  const labels = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[title="Close figure"]')).map(
      // Close button's parent is now a button-group div (minimize+close),
      // one level up from the title bar row that holds the label span.
      (btn) => btn.parentElement?.parentElement?.querySelector('span')?.textContent,
    ),
  );
  console.log('figure labels:', JSON.stringify(labels));

  const commandWindowText = await page.evaluate(() => {
    const cw = Array.from(document.querySelectorAll('div')).find((d) => d.textContent === 'Command Window');
    return cw?.parentElement?.textContent ?? '';
  });
  console.log('plot NOT inline in command window text:', !commandWindowText.includes('scatter'));
  console.log('command window still shows disp() text:', commandWindowText.includes('done one') && commandWindowText.includes('done two'));

  // Drag the first figure and confirm its position changes
  const header = page.locator('.cursor-move').first();
  const box = await header.boundingBox();
  await page.mouse.move(box.x + 20, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 150, box.y + 120, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const newBox = await header.boundingBox();
  console.log('figure dragged (position changed):', Math.abs(newBox.x - box.x) > 50);

  // Close one figure
  const closeButtons = page.locator('[title="Close figure"]');
  const countBefore = await page.evaluate(() => document.querySelectorAll('.js-plotly-plot').length);
  await closeButtons.first().click();
  await page.waitForTimeout(300);
  const countAfter = await page.evaluate(() => document.querySelectorAll('.js-plotly-plot').length);
  console.log('closing a figure removes it:', countAfter === countBefore - 1);

  await page.screenshot({ path: 't31-figures.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
