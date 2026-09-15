// Real kernel and real elapsed time. Shorten only the notice delay; t137
// separately covers the production one-minute threshold and minute display.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:4180/';
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.addInitScript(() => {
      localStorage.setItem('engr183-persistence-ack', '1');
      localStorage.setItem('engr183-onboarding-seen', '1');
      const original = window.setTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) => original(callback, delay === 60000 ? 1500 : delay, ...args);
    });
    await page.goto(BASE + '?unit=scratch', { timeout: 90000 });
    async function ready() {
      await page.waitForFunction(() => [...document.querySelectorAll('span')].some(s => s.textContent === 'Ready'), null, { timeout: 90000 });
    }
    await ready();
    const elapsed = page.getByLabel('Elapsed run time');
    const notice = page.getByRole('status').filter({ hasText: 'This script is taking a while' });
    const input = page.getByPlaceholder(/Type an Octave command/);
    for (let attempt = 0; attempt < 2; attempt++) {
      await input.fill('while true; end');
      await input.press('Enter');
      await elapsed.waitFor();
      assert.match(await elapsed.innerText(), /^0:0\d$/, 'Each run starts with a fresh timer');
      await notice.waitFor();
      const before = await elapsed.innerText();
      assert.match(before, /^0:0[1-9]$/, 'Timer shows elapsed seconds');
      await page.waitForTimeout(2100);
      assert.notEqual(await elapsed.innerText(), before, 'Timer keeps advancing after the warning');
      await page.getByRole('button', { name: 'Stop', exact: true }).click();
      await ready();
      assert.equal(await elapsed.count(), 0);
      assert.equal(await notice.count(), 0);
    }
    console.log('PASS: elapsed time advances beyond the notice, clears on Stop, and resets for the next run');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
