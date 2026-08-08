const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground/';

  await page.goto(base + '?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });

  let text = await page.evaluate(() => document.body.innerText);
  console.log('prod: Workspace panel present:', text.includes('Workspace'));
  console.log('prod: Workspace initially empty:', text.includes('No variables'));

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 1:0.1:10; y = sin(x); name = 'hello'; plot(x, y); disp('done')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('done'), null, { timeout: 30000 });
  await page.waitForSelector('.js-plotly-plot', { timeout: 20000 });
  await page.waitForTimeout(500);

  text = await page.evaluate(() => document.body.innerText);
  console.log('prod: workspace shows x, y, name, ans:', /\bx\b/.test(text) && /\by\b/.test(text) && text.includes('name') && /\bans\b/.test(text));
  console.log('prod: no internal fid leak:', !text.includes('fid'));

  const sizing = await page.evaluate(() => {
    const plotDiv = document.querySelector('.js-plotly-plot');
    const plotBox = plotDiv.getBoundingClientRect();
    let container = plotDiv;
    while (container && !container.style.left) container = container.parentElement;
    const containerBox = container ? container.getBoundingClientRect() : null;
    const fullLayout = plotDiv._fullLayout;
    return {
      plotW: Math.round(plotBox.width), plotH: Math.round(plotBox.height),
      containerW: containerBox ? Math.round(containerBox.width) : null,
      containerH: containerBox ? Math.round(containerBox.height) : null,
      paperBg: fullLayout ? fullLayout.paper_bgcolor : null,
      plotBg: fullLayout ? fullLayout.plot_bgcolor : null,
    };
  });
  console.log('prod: sizing/bg:', JSON.stringify(sizing));
  console.log('prod: plot fills window:', Math.abs(sizing.plotW - sizing.containerW) < 15);
  console.log('prod: background is white:', sizing.paperBg === '#ffffff' && sizing.plotBg === '#ffffff');

  await page.screenshot({ path: 't35-prod.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
