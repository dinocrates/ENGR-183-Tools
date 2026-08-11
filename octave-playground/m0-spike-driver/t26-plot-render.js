const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));

  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
  });
  await page.goto('http://localhost:4173/?unit=unit01', { waitUntil: 'load', timeout: 45000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  // Replace the active file's content via Monaco. keyboard.type() fires real
  // keydown events, which Monaco's autoclosing-brackets feature intercepts --
  // typing "(" auto-inserts ")" and the literal ")" we then type duplicates
  // it, garbling anything with brackets/parens. insertText() bypasses that
  // (paste-like, no per-key handling).
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("plot([1 2 3],[4 5 6]); xlabel('x'); title('t'); disp('plot done')");

  await page.getByText('Run File', { exact: true }).click();
  try {
    await page.waitForFunction(() => document.body.innerText.includes('plot done'), null, { timeout: 30000 });
    console.log('run completed (plot done printed)');
  } catch (e) {
    console.log('run did not complete within 30s:', e.message);
  }
  await page.waitForTimeout(1500);

  const hasSvg = await page.evaluate(() => !!document.querySelector('.js-plotly-plot'));
  console.log('plotly chart rendered (.js-plotly-plot present):', hasSvg);
  const text = await page.evaluate(() => document.body.innerText);
  console.log('unsupported-type fallback shown:', text.includes('unsupported output type'));
  console.log('command window text:', text.slice(text.indexOf('Command Window')));
  console.log('console/page errors:', logs.filter(l => l.includes('error') || l.includes('Error')).slice(0, 10));

  await page.screenshot({ path: 't26-plot.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
