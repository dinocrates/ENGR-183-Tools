const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground/';

  await page.route('**/plotly.min-*.js', async (route) => {
    await new Promise((r) => setTimeout(r, 3000));
    await route.continue();
  });

  await page.goto(base + '?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.getByText('Got it', { exact: true }).click({ timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("plot(1:10, sin(1:10)); disp('done')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForSelector('[title="Close figure"]', { timeout: 15000 });
  await page.waitForTimeout(500);

  const spinnerVisible = await page.getByText('Rendering…', { exact: true }).isVisible().catch(() => false);
  console.log('prod: spinner visible during delay:', spinnerVisible);
  const noChartYet = (await page.locator('.js-plotly-plot').count()) === 0;
  console.log('prod: no chart rendered yet:', noChartYet);

  await page.waitForSelector('.js-plotly-plot', { timeout: 15000 });
  await page.waitForTimeout(300);
  const spinnerGone = await page.getByText('Rendering…', { exact: true }).isVisible().catch(() => false);
  console.log('prod: spinner gone once rendered:', !spinnerGone);

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
