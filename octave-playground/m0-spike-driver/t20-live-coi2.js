const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));

  await page.goto('https://dinocrates.github.io/ENGR-183-Tools/octave-playground/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  console.log('after first load, isolated:', await page.evaluate(() => window.crossOriginIsolated));

  console.log('--- navigating again (simulating manual reload) ---');
  await page.goto('https://dinocrates.github.io/ENGR-183-Tools/octave-playground/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  console.log('after second load, isolated:', await page.evaluate(() => window.crossOriginIsolated));

  console.log('--- navigating a third time ---');
  await page.goto('https://dinocrates.github.io/ENGR-183-Tools/octave-playground/', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(3000);
  console.log('after third load, isolated:', await page.evaluate(() => window.crossOriginIsolated));

  console.log('=== logs ===');
  console.log(logs.join('\n'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
