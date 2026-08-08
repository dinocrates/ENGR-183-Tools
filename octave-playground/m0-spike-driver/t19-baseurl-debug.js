const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://dinocrates.github.io/ENGR-183-Tools/octave-playground/', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });
  await page.waitForTimeout(2000);

  const result = await page.evaluate(() => {
    const configEl = document.getElementById('jupyter-config-data');
    return {
      configElText: configEl ? configEl.textContent : 'MISSING',
      locationHref: window.location.href,
    };
  });
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
