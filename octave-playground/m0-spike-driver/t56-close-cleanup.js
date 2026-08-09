const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));

  await page.goto('http://localhost:5183/?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("plot(1:10, sin(1:10)); disp('done')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('done'), null, { timeout: 30000 });
  await page.waitForSelector('.js-plotly-plot', { timeout: 20000 });
  await page.waitForTimeout(500);

  const before = await page.evaluate(() => ({
    plotlyDivs: document.querySelectorAll('.js-plotly-plot').length,
    plotlySvgNodes: document.querySelectorAll('.plot-container svg').length,
    figureWindows: document.querySelectorAll('[title="Close figure"]').length,
    totalDomNodes: document.querySelectorAll('*').length,
  }));
  console.log('before close:', JSON.stringify(before));

  await page.locator('[title="Close figure"]').click();
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => ({
    plotlyDivs: document.querySelectorAll('.js-plotly-plot').length,
    plotlySvgNodes: document.querySelectorAll('.plot-container svg').length,
    figureWindows: document.querySelectorAll('[title="Close figure"]').length,
    totalDomNodes: document.querySelectorAll('*').length,
  }));
  console.log('after close:', JSON.stringify(after));

  console.log('plotly DOM fully removed:', after.plotlyDivs === 0 && after.plotlySvgNodes === 0);
  console.log('figure window DOM fully removed:', after.figureWindows === 0);
  console.log('DOM node count dropped (real cleanup, not just hidden):', after.totalDomNodes < before.totalDomNodes - 20);

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
