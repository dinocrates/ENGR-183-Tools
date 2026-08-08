const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));

  await page.goto('http://localhost:5183/?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 0:0.1:6; plot(x, sin(x)); hold on; plot(x, cos(x)); legend('sin(x)','cos(x)'); disp('run one done')");

  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('run one done'), null, { timeout: 30000 });
  await page.waitForSelector('.js-plotly-plot', { timeout: 20000 });
  await page.waitForTimeout(500);
  console.log('figures after run 1:', await page.evaluate(() => document.querySelectorAll('.js-plotly-plot').length));

  // Check whether the figure window overlaps the toolbar buttons (the actual bug)
  const overlap = await page.evaluate(() => {
    const runFileBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Run File');
    const closeBtn = document.querySelector('[title="Close figure"]');
    const figWindow = closeBtn ? closeBtn.closest('.absolute') : null;
    if (!runFileBtn || !figWindow) return null;
    const b = runFileBtn.getBoundingClientRect();
    const f = figWindow.getBoundingClientRect();
    const overlaps = !(b.right < f.left || b.left > f.right || b.bottom < f.top || b.top > f.bottom);
    return { runFileBtnBox: b, figWindowBox: f, overlaps };
  });
  console.log('figure window overlaps Run File button:', JSON.stringify(overlap?.overlaps));

  // Close the figure explicitly so it's out of the way, then re-run
  await page.locator('[title="Close figure"]').click();
  await page.waitForTimeout(200);

  logs.length = 0;
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForTimeout(3000);
  console.log('=== RUN 2 messages (after closing run-1 figure) ===');
  console.log(logs.filter(l => l.includes('DEBUG msg_type')).join('\n'));
  const figCountAfterRun2 = await page.evaluate(() => document.querySelectorAll('.js-plotly-plot').length);
  console.log('figures after run 2:', figCountAfterRun2);

  await page.screenshot({ path: 't36b-after-rerun.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
