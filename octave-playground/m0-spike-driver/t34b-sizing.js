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
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const plotDiv = document.querySelector('.js-plotly-plot');
    const plotBox = plotDiv.getBoundingClientRect();
    // FloatingFigure's root is the nearest ancestor with inline left/top style
    let container = plotDiv;
    while (container && !container.style.left) container = container.parentElement;
    const containerBox = container ? container.getBoundingClientRect() : null;
    const fullLayout = plotDiv._fullLayout;
    return {
      plotW: Math.round(plotBox.width),
      plotH: Math.round(plotBox.height),
      containerW: containerBox ? Math.round(containerBox.width) : null,
      containerH: containerBox ? Math.round(containerBox.height) : null,
      paperBg: fullLayout ? fullLayout.paper_bgcolor : null,
      plotBg: fullLayout ? fullLayout.plot_bgcolor : null,
      layoutWidth: fullLayout ? fullLayout.width : null,
      layoutHeight: fullLayout ? fullLayout.height : null,
      autosize: fullLayout ? fullLayout.autosize : null,
    };
  });
  console.log('result:', JSON.stringify(result, null, 2));
  console.log('plot fills its window (within 15px):', Math.abs(result.plotW - result.containerW) < 15 && Math.abs(result.plotH - result.containerH) < 60);
  console.log('background is white:', result.paperBg === '#ffffff' && result.plotBg === '#ffffff');

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
