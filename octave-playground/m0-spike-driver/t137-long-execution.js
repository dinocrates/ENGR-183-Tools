// Real Octave: a >60s computation must finish after the advisory appears.
// Later cases shorten only the app's 60s notice timer, not kernel execution.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://127.0.0.1:4180/';

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
    await page.addInitScript(() => {
      localStorage.setItem('engr183-persistence-ack', '1');
      localStorage.setItem('engr183-onboarding-seen', '1');
      const original = window.setTimeout.bind(window);
      window.setTimeout = (callback, delay, ...args) =>
        original(callback, delay === 60000 ? (window.testNoticeDelay ?? delay) : delay, ...args);
    });
    await page.goto(BASE + '?unit=scratch', { timeout: 90000 });
    const run = page.getByRole('button', { name: 'Run File', exact: true });
    const stop = page.getByRole('button', { name: 'Stop', exact: true });
    const notice = page.getByRole('status').filter({ hasText: 'This script is taking a while to execute.' });
    const repl = page.getByPlaceholder(/Type an Octave command|Continue the block/);
    async function ready() {
      await page.waitForFunction(() => [...document.querySelectorAll('span')].some(s => s.textContent === 'Ready'), null, { timeout: 90000 });
      assert(await run.isEnabled());
    }
    async function script(code, button = run) {
      await page.locator('.monaco-editor').click();
      await page.keyboard.press('Control+A');
      await page.keyboard.insertText(code);
      await button.click();
    }
    async function warned() {
      await notice.waitFor({ timeout: 70000 });
      assert(await run.isDisabled(), 'Run stays disabled after the notice');
      assert(await stop.isEnabled(), 'Stop remains available');
      assert((await notice.innerText()).includes('long calculation, or it may be frozen'));
      assert(!(await page.locator('body').innerText()).includes('Kernel did not respond in time'));
    }
    async function closeFigures() {
      while (await page.getByTitle('Close figure', { exact: true }).count()) {
        await page.getByTitle('Close figure', { exact: true }).last().click();
      }
    }
    await ready();
    assert.deepEqual((await page.getByRole('alert').allTextContents()).filter(t => t.trim()), [], 'No startup errors in a fresh browser');
    const started = Date.now();
    await script("clc; tic; while toc < 65; end;\nlong_result = 42; disp(long_result);\nplot([1 2 3], [2 4 6]); title('Finished after warning');");
    await warned();
    assert(Date.now() - started >= 59000, 'Production notice threshold is one minute');
    // The display ticks once a second and mounts just after execution starts.
    await page.waitForFunction(() => /^1:\d{2}$/.test(document.querySelector('[aria-label="Elapsed run time"]')?.textContent ?? ''), null, { timeout: 3000 });
    assert(await page.getByPlaceholder('Kernel busy…', { exact: true }).isDisabled(), 'A second command cannot run while waiting');
    await ready();
    assert.equal(await notice.count(), 0);
    assert.equal(await page.getByLabel('Elapsed run time').count(), 0, 'Elapsed timer clears when the run finishes');
    assert((await page.locator('pre').allTextContents()).join('\n').includes('42'));
    await closeFigures();
    const saved = page.locator('section[aria-label="Saved figures"] button[title^="Open "]');
    assert.equal(await saved.count(), 1, 'Late plot is saved after completion');
    await saved.first().click();
    await page.waitForFunction(() => document.querySelector('.js-plotly-plot')?.data?.[0]?.y?.[2] === 6);
    await closeFigures();
    console.log('PASS: real 65-second script warns, finishes, returns output, and saves its interactive figure');

    await page.evaluate(() => { window.testNoticeDelay = 1000; });
    await script("marker = 123; while true; end;");
    await warned();
    await stop.click();
    assert(await run.isDisabled(), 'Restart keeps Run disabled');
    await ready();
    assert.equal(await notice.count(), 0);
    assert(!(await page.locator('table').allTextContents()).join('\n').includes('marker'));
    await repl.fill('disp(7 * 9)');
    await repl.press('Enter');
    await ready();
    assert((await page.locator('pre').allTextContents()).join('\n').includes('63'));
    console.log('PASS: infinite loop stays stoppable; restart clears the notice/variables and accepts a fresh command');

    // A prompt must hide an existing notice and suspend its timer until answered.
    await script("tic; while toc < 2; end;\nanswer = input('Enter value: ');\ntic; while toc < 2; end; disp(answer + 1);");
    await warned();
    const answer = page.getByPlaceholder('Enter value: (answer, then Enter)');
    await answer.waitFor({ timeout: 10000 });
    await page.waitForTimeout(1500);
    assert.equal(await notice.count(), 0, 'No warning while waiting for student input');
    await answer.fill('123');
    await answer.press('Enter');
    await warned();
    await ready();
    assert.equal(await notice.count(), 0);
    assert((await page.locator('pre').allTextContents()).join('\n').includes('124'));
    console.log('PASS: input suspends the notice, answering re-arms it, and execution completes');

    await script("tic; while toc < 2; end; error('expected-late-error');");
    await warned();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Run File' && !b.disabled));
    assert.equal(await notice.count(), 0);
    assert((await page.locator('pre').allTextContents()).join('\n').includes('expected-late-error'));
    console.log('PASS: an actual Octave error after the notice is still reported and clears the notice');

    await script("tic; while toc < 2; end; disp('debug-long-complete');", page.getByRole('button', { name: 'Debug', exact: true }));
    await warned();
    await ready();
    assert.equal(await notice.count(), 0);
    assert((await page.locator('pre').allTextContents()).join('\n').includes('debug-long-complete'));
    await script('while true; end;', page.getByRole('button', { name: 'Debug', exact: true }));
    await warned();
    await stop.click();
    await ready();
    assert.equal(await notice.count(), 0);
    console.log('PASS: Debug uses the same advisory and can finish or restart after warning');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
