const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });

  await page.goto('http://localhost:5183/?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 0:0.1:6; plot(x, sin(x)); hold on; plot(x, cos(x)); legend('sin(x)','cos(x)'); disp('done')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('done'), null, { timeout: 30000 });
  await page.waitForSelector('.js-plotly-plot', { timeout: 20000 });
  await page.waitForTimeout(1000);

  const dump = await page.evaluate(() => {
    const plotDiv = document.querySelector('.js-plotly-plot');
    return plotDiv.data.map(t => ({
      name: t.name, showlegend: t.showlegend, type: t.type, mode: t.mode,
      text: t.text, textposition: t.textposition, hoverinfo: t.hoverinfo,
      xLen: t.x ? t.x.length : null, yLen: t.y ? t.y.length : null,
      xSample: t.x ? t.x.slice(0,3) : null,
    }));
  });
  console.log(JSON.stringify(dump, null, 2));

  // Also find ALL text elements anywhere in the svg containing sin or cos
  const allTexts = await page.evaluate(() => {
    const plotDiv = document.querySelector('.js-plotly-plot');
    return Array.from(plotDiv.querySelectorAll('text')).filter(t => /sin|cos/.test(t.textContent)).map(t => ({
      content: t.textContent,
      classAttr: t.getAttribute('class'),
      parentClass: t.parentElement?.getAttribute('class'),
      grandparentClass: t.parentElement?.parentElement?.getAttribute('class'),
      bbox: t.getBoundingClientRect(),
    }));
  });
  console.log('all text elements with sin/cos:', JSON.stringify(allTexts, null, 2));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
