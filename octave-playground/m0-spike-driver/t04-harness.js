const { chromium } = require('playwright');
const { runCell } = require('./console-driver.js');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000/repl/index.html?kernel=xoctave&toolbar=1', {
    waitUntil: 'networkidle', timeout: 60000,
  });
  await page.waitForTimeout(4000);

  const out1 = await runCell(page, "addpath('/engr183'); addpath('/engr183/tests'); engr183.runTests('unit00')");
  console.log('=== UNSOLVED (mounted, expect 0/6) ===');
  console.log(out1);

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
