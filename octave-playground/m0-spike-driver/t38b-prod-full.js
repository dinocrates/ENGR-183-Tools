const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground/';

  await page.goto(base + '?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 0:0.1:6; plot(x, sin(x)); hold on; plot(x, cos(x)); legend('sin(x)','cos(x)'); disp('run one done')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('run one done'), null, { timeout: 30000 });
  await page.waitForSelector('.js-plotly-plot', { timeout: 20000 });
  await page.waitForTimeout(600);

  const overlap = await page.evaluate(() => {
    const runFileBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Run File');
    const closeBtn = document.querySelector('[title="Close figure"]');
    const figWindow = closeBtn ? closeBtn.closest('.absolute') : null;
    const b = runFileBtn.getBoundingClientRect();
    const f = figWindow.getBoundingClientRect();
    return !(b.right < f.left || b.left > f.right || b.bottom < f.top || b.top > f.bottom);
  });
  console.log('prod: figure overlaps Run File:', overlap);

  await page.getByText('Run File', { exact: true }).click({ timeout: 5000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 15000 });
  console.log('prod: direct re-run click succeeded with figure open:', true);

  const legendCheck = await page.evaluate(() => {
    const plotDiv = document.querySelector('.js-plotly-plot');
    const hasNativeLegend = !!plotDiv._fullLayout?.legend;
    const annotationTexts = Array.from(plotDiv.querySelectorAll('.annotation-text')).map((t) => t.textContent);
    const legendTexts = Array.from(plotDiv.querySelectorAll('.legendtext')).map((t) => t.textContent);
    return { hasNativeLegend, annotationTexts, legendTexts };
  });
  console.log('prod: no duplicate native legend:', !legendCheck.hasNativeLegend && legendCheck.legendTexts.length === 0);
  console.log('prod: exactly one sin(x)/cos(x) annotation pair:', JSON.stringify(legendCheck.annotationTexts) === JSON.stringify(['sin(x)', 'cos(x)']));

  await page.screenshot({ path: 't38-prod.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
