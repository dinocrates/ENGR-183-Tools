const { chromium } = require('playwright');

async function runOnce(n) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));

  await page.goto('https://dinocrates.github.io/ENGR-183-Tools/octave-playground/', {
    waitUntil: 'load',
    timeout: 60000,
  });

  // Realistic settle window covering the vendored script's reload AND our
  // own guarded retry reload (fires ~1.5s after load if still not isolated).
  await page.waitForTimeout(6000);
  const isolated = await page.evaluate(() => window.crossOriginIsolated);

  let status = 'unknown';
  try {
    await page.waitForFunction(
      () => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'),
      { timeout: 30000 }
    );
    status = (await page.evaluate(() => document.body.innerText.slice(0, 40))).includes('Ready') ? 'READY' : 'ERROR-STATUS';
  } catch (e) {
    status = 'TIMEOUT';
  }

  console.log(`[run ${n}] isolated=${isolated} status=${status}`);
  await browser.close();
  return { isolated, status };
}

(async () => {
  const results = [];
  for (let i = 1; i <= 5; i++) {
    results.push(await runOnce(i));
  }
  const allGood = results.every(r => r.isolated === true && r.status === 'READY');
  console.log('\n=== SUMMARY ===');
  console.log(JSON.stringify(results));
  console.log(allGood ? 'ALL 5 RUNS PASSED' : 'SOME RUNS FAILED');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
