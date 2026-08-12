const { chromium } = require('playwright');

let pass = 0, fail = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (ok) pass++; else fail++;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const base = 'http://localhost:4173/';

  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
  });
  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 90000 });
  await page.waitForTimeout(500);

  const input = page.getByPlaceholder(/Type an Octave command|Continue the block/);
  const pendingPreview = page.locator('[class*="bg-raised/40"]');
  function outputText() {
    return page.evaluate(() => {
      const pre = Array.from(document.querySelectorAll('pre')).find((p) => p.closest('.flex.h-full.flex-col.bg-app'));
      return pre ? pre.innerText : null;
    });
  }
  async function submitLine(line) {
    await input.fill(line);
    await input.press('Enter');
    await page.waitForTimeout(150);
  }
  // Scoped to the Command Window's own output -- document.body.innerText is
  // unsafe to wait on here since Monaco's line-number gutter already
  // contains "1"/"2"/"3"/... regardless of whether anything has executed.
  // Checks only the *suffix* beyond a prior snapshot for a marker: output is
  // persistent now, so a plain includes() would trivially match digits left
  // over from earlier commands in the same session, and the echo itself
  // lands synchronously (before the kernel round-trip even starts), so a
  // mere length-growth check resolves too early too.
  async function waitForResultAfter(beforeText, needle, timeout = 15000) {
    await page.waitForFunction(
      ({ before, needle: n, sel }) => {
        const pre = Array.from(document.querySelectorAll('pre')).find((p) => p.closest(sel));
        return !!pre && pre.innerText.slice(before.length).includes(n);
      },
      { before: beforeText, needle, sel: '.flex.h-full.flex-col.bg-app' },
      { timeout },
    );
  }

  // --- Basic multi-line for loop across 3 Enters ---
  let text = await outputText();
  const beforeLoop = text;
  await submitLine('for i = 1:3');
  check('continuation prompt (..) appears after an unclosed for', await pendingPreview.isVisible());
  check('input placeholder switches to the continuation hint', (await input.getAttribute('placeholder')).includes('Continue the block'));
  await submitLine('disp(i)');
  check('still continuing after a second incomplete line', await pendingPreview.isVisible());
  await submitLine('end');
  await waitForResultAfter(beforeLoop, '2');
  const loopOutput = await outputText();
  check('block executes once closed, prints 1/2/3', /1[\s\S]*2[\s\S]*3/.test(loopOutput));
  check('pending preview clears once the block executes', !(await pendingPreview.isVisible()));

  // --- Critical correctness: end-as-index must not be misread as a block closer ---
  await submitLine('A = [1 2 3];');
  check('a plain single-line command with a semicolon does not trigger continuation', !(await pendingPreview.isVisible()));
  text = await outputText();
  const beforeNested = text;

  await submitLine('if true');
  check('if opens continuation', await pendingPreview.isVisible());
  await submitLine('disp(A(end))');
  check('A(end) inside the if body does NOT close it (still continuing)', await pendingPreview.isVisible());
  await submitLine('end');
  await waitForResultAfter(beforeNested, '3');
  text = await outputText();
  check('nested if/A(end)/end executes correctly and prints 3 (last element)', text.slice(beforeNested.length).includes('3'));
  check('the real closing end did close the block (preview cleared)', !(await pendingPreview.isVisible()));

  // --- Strings/comments containing block keywords must not false-trigger ---
  await submitLine("disp('the end')");
  check("a string containing the word 'end' does not trigger continuation", !(await pendingPreview.isVisible()));
  await page.waitForFunction(() => document.body.innerText.includes('the end'), null, { timeout: 15000 });

  await submitLine('x = 5; % for testing');
  check("a comment containing the word 'for' does not trigger continuation", !(await pendingPreview.isVisible()));

  // --- Escape cancels a pending buffer without touching prior output ---
  text = await outputText();
  const beforeEscape = text;
  await submitLine('for k = 1:5');
  check('continuation started before Escape test', await pendingPreview.isVisible());
  await input.press('Escape');
  await page.waitForTimeout(200);
  check('Escape clears the pending buffer', !(await pendingPreview.isVisible()));
  check('Escape does not touch prior persistent output', (await outputText()) === beforeEscape);
  check('input is empty after Escape', (await input.inputValue()) === '');

  // --- History recall of a multi-line block ---
  await submitLine('for i = 1:2');
  await submitLine('disp(i)');
  await submitLine('end');
  await page.waitForTimeout(300);
  await input.press('ArrowUp');
  check('ArrowUp recalls a multi-line block into the pending preview', await pendingPreview.isVisible());
  const previewText = await pendingPreview.innerText();
  check('recalled preview shows the earlier lines of the block', previewText.includes('for i = 1:2') && previewText.includes('disp(i)'));
  check('recalled input holds the last line of the block', (await input.inputValue()) === 'end');

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
