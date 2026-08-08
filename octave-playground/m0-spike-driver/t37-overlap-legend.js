const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1')); // T3.4: skip the first-visit warning, not what this script tests

  await page.goto('http://localhost:5183/?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("x = 0:0.1:6; plot(x, sin(x)); hold on; plot(x, cos(x)); legend('sin(x)','cos(x)'); disp('run one done')");

  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('run one done'), null, { timeout: 30000 });
  await page.waitForSelector('.js-plotly-plot', { timeout: 20000 });
  await page.waitForTimeout(600);

  // T3.6-follow-up bug: the Figure window used to spawn directly on top of
  // the Toolbar (cascade started at 24,24), silently blocking Run Tests/Run
  // File/Download -- a click there was intercepted by the figure window, not
  // the button underneath. Reported by Stephen as "weird" re-run behavior;
  // it wasn't a data/kernel bug at all, see t36b-rerun-debug.js.
  const overlap = await page.evaluate(() => {
    const runFileBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Run File');
    const closeBtn = document.querySelector('[title="Close figure"]');
    const figWindow = closeBtn ? closeBtn.closest('.absolute') : null;
    if (!runFileBtn || !figWindow) return null;
    const b = runFileBtn.getBoundingClientRect();
    const f = figWindow.getBoundingClientRect();
    return !(b.right < f.left || b.left > f.right || b.bottom < f.top || b.top > f.bottom);
  });
  console.log('figure window overlaps Run File button:', overlap);

  // Prove the fix directly: click Run File again with the figure still open,
  // not overlapping -- this used to be exactly the click that would silently
  // miss the button.
  await page.getByText('Run File', { exact: true }).click({ timeout: 5000 });
  await page.waitForFunction(() => document.body.innerText.includes('Running'), null, { timeout: 5000 }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 15000 });
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('re-run completed successfully (clicked directly, figure still open):', bodyText.includes('run one done') && bodyText.includes('Ready'));

  // Legend doubling bug: Octave's legend() is implemented by xeus-octave as
  // Plotly *annotations* (text + leader lines), with showlegend:false set
  // deliberately to suppress Plotly's own native legend underneath. An
  // earlier version of PlotOutput.tsx forced showlegend:true and a custom
  // `legend` position, not realizing that -- Plotly's real legend then
  // rendered ON TOP of the kernel's own, a visibly doubled/offset legend box
  // (see m0-spike-driver/t37i-alltraces.js for how this was root-caused).
  // Correct state now: no native Plotly legend at all, exactly one
  // "sin(x)"/"cos(x)" pair via annotation-text.
  const legendCheck = await page.evaluate(() => {
    const plotDiv = document.querySelector('.js-plotly-plot');
    const hasNativeLegend = !!plotDiv._fullLayout?.legend;
    const annotationTexts = Array.from(plotDiv.querySelectorAll('.annotation-text')).map((t) => t.textContent);
    const legendTexts = Array.from(plotDiv.querySelectorAll('.legendtext')).map((t) => t.textContent);
    return { hasNativeLegend, annotationTexts, legendTexts };
  });
  console.log('legend check:', JSON.stringify(legendCheck));
  console.log('no duplicate native Plotly legend:', !legendCheck.hasNativeLegend && legendCheck.legendTexts.length === 0);
  console.log('exactly one sin(x)/cos(x) annotation pair:', JSON.stringify(legendCheck.annotationTexts) === JSON.stringify(['sin(x)', 'cos(x)']));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
