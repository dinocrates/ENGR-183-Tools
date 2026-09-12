const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
  });
  await page.goto('http://localhost:5184/?unit=u05-gp05-fault-creep', { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 200000 });
  await page.waitForTimeout(800);

  await page.getByText('Run Tests', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const out = await page.evaluate(() => document.body.innerText);
  console.log(/Score: \d+\/10.*/.exec(out)?.[0]);
  console.log(/Criteria met: \d+ of \d+/.exec(out)?.[0]);
  console.log(out.includes('Score: 1/10') ? 'PASS: matches golden (1/10)' : 'MISMATCH from expected golden baseline');

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
