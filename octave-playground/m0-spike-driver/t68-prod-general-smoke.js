const { chromium } = require('playwright');

let pass = 0, fail = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (ok) pass++; else fail++;
}

(async () => {
  const browser = await chromium.launch();
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground/';

  // --- Unit index page (its own fresh page/context) ---
  const indexPage = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await indexPage.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));
  await indexPage.goto(base, { waitUntil: 'load', timeout: 30000 });
  await indexPage.waitForTimeout(1000);
  const indexText = await indexPage.evaluate(() => document.body.innerText);
  check('unit index lists Unit 1', indexText.includes('Unit 1'));
  check('unit index lists Scratch Pad', indexText.includes('Scratch Pad'));
  await indexPage.close();

  // --- Scratch Pad: figures (own fresh page, direct navigation --
  // the COOP/COEP service worker triggers one involuntary reload on a
  // cold visit to this origin, which can destroy an in-flight execution
  // context if other navigations/interactions race it; going straight to
  // the target URL in a brand new page/context and settling after Ready
  // avoids that). ---
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));
  await page.goto(base + '?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 90000 });
  await page.waitForTimeout(1500); // settle past any trailing SW-reload

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText([
    "x = 0:0.1:2*pi;",
    "plot(x, sin(x));",
    "figure;",
    "plot(x, cos(x));",
    "legend('cos');",
    "disp('plots done');",
  ].join('\n'));
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('plots done'), null, { timeout: 30000 });
  await page.waitForTimeout(2000);

  const figCount = await page.locator('[title="Close figure"]').count();
  check('exactly 2 figure windows opened', figCount === 2);
  const plotCount = await page.locator('.js-plotly-plot').count();
  check('exactly 2 real rendered plots', plotCount === 2);

  const firstMinimize = page.locator('[title="Minimize figure"]').first();
  await firstMinimize.click();
  await page.waitForTimeout(300);
  const minimizedCount = await page.locator('[title="Expand figure"]').count();
  check('figure minimizes correctly', minimizedCount === 1);

  const closeButtons = page.locator('[title="Close figure"]');
  await closeButtons.first().click();
  await page.waitForTimeout(300);
  const afterCloseFigCount = await page.locator('[title="Close figure"]').count();
  check('closing a figure removes it (1 remains)', afterCloseFigCount === 1);

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
