const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));

  // Artificially delay the plotly.js-dist-min chunk to make the loading
  // window long enough to reliably observe, instead of racing a render
  // that's normally sub-second on localhost.
  await page.route('**/plotly.min-*.js', async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });

  await page.goto('http://localhost:5183/?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("plot(1:10, sin(1:10)); disp('done')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('done'), null, { timeout: 30000 });

  // Right after the figure window appears, the plotly chunk is still
  // "loading" (artificially delayed) -- spinner should be visible now.
  await page.waitForSelector('[title="Close figure"]', { timeout: 10000 });
  await page.waitForTimeout(500);
  const spinnerVisibleEarly = await page.getByText('Rendering…', { exact: true }).isVisible().catch(() => false);
  console.log('spinner visible while plotly chunk still loading:', spinnerVisibleEarly);
  const plotVisibleEarly = await page.locator('.js-plotly-plot').count();
  console.log('plot NOT yet rendered during that window:', plotVisibleEarly === 0);

  await page.screenshot({ path: 't57-spinner.png' });

  // Wait for the artificial delay to pass and the real render to complete
  await page.waitForSelector('.js-plotly-plot', { timeout: 15000 });
  await page.waitForTimeout(300);
  const spinnerGoneAfter = await page.getByText('Rendering…', { exact: true }).isVisible().catch(() => false);
  console.log('spinner gone once plot actually rendered:', !spinnerGoneAfter);

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
