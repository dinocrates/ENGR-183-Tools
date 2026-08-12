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

  const input = page.getByPlaceholder('Type an Octave command…');
  function outputText() {
    return page.evaluate(() => {
      const pre = Array.from(document.querySelectorAll('pre')).find((p) => p.closest('.flex.h-full.flex-col.bg-app'));
      return pre ? pre.innerText : null;
    });
  }

  check('REPL input is present and enabled at kernel-ready', await input.isEnabled());

  // Basic command + echo + result
  await input.fill('disp(6 * 7)');
  await input.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('42'), null, { timeout: 15000 });
  let text = await outputText();
  check('typed command is echoed with >> prefix', text.includes('>> disp(6 * 7)'));
  check('typed command result appears', text.includes('42'));

  // Kernel busy: input disables mid-command. An ordinary one-liner's round
  // trip can be too fast to reliably sample with a single fixed-delay check
  // -- use a CPU-bound loop for a generous busy window (calibrated
  // empirically: Octave for-loops run at roughly 26k-45k iterations/sec
  // under this WASM interpreter, so 5e4 gives a window comfortably over
  // 500ms), and detect it by continuously polling for the disabled
  // attribute (page.waitForFunction) rather than a single point-in-time
  // sample, so this doesn't depend on winning a timing race. (Tried
  // pause(1) first: it hangs indefinitely in this kernel, almost certainly
  // because session.ts's execute_request sets allow_stdin: false and
  // pause's internals depend on stdin even for the numeric-duration form --
  // do not use pause() in this app's REPL tests.)
  await input.fill('x = 0; for k = 1:5e4, x = x + 1; end; disp(x)');
  await input.press('Enter');
  const sawBusy = await page
    .waitForFunction(() => {
      const el = document.querySelector('input[placeholder="Kernel busy…"]');
      return !!el && el.disabled;
    }, null, { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  await page.waitForFunction(() => document.body.innerText.includes('50000'), null, { timeout: 20000 });
  check('input disables while a REPL command is executing', sawBusy);
  await page.waitForFunction(() => !document.querySelector('input[placeholder="Kernel busy…"]'), null, { timeout: 15000 });
  check('input re-enables after the command finishes', await input.isEnabled());
  // Give the heavy loop's own refreshWorkspace() call (triggered by runCode
  // right after it) a moment to fully settle before the next execute() call
  // below reassigns the kernel's message handler -- a stray late stdout
  // chunk from a heavy computation landing just as the next execute() call
  // takes over the handler is a real, pre-existing race in session.ts's
  // per-call sendMessage reassignment (confirmed via m0-spike-driver
  // debugging; affects Run Tests/Run File too, not specific to the REPL --
  // out of scope to fix here). Using a separate lightweight command below
  // for the Workspace-panel assertion sidesteps it rather than fighting it.
  await page.waitForTimeout(1000);

  // Workspace panel reflects a REPL-defined variable (Name/Size/Class only,
  // no value column -- check the panel itself, not just page-wide text,
  // since the console's own echo would otherwise make this trivially true).
  await input.fill('y = 99');
  await input.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('y = 99'), null, { timeout: 15000 });
  await page.waitForTimeout(500);
  const workspaceText = await page.evaluate(() => {
    const table = document.querySelector('table');
    return table ? table.innerText : '';
  });
  check('Workspace panel updates after a REPL command (not just Run Tests/Run File)', workspaceText.includes('y'));

  // Persistent output: running Run File does NOT wipe prior REPL history
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("disp('from Run File');\n");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('from Run File'), null, { timeout: 15000 });
  text = await outputText();
  check('Run File output persists alongside earlier REPL history (no auto-clear)', text.includes('42') && text.includes('from Run File'));

  // clc clears without hitting the kernel
  await input.fill('clc');
  await input.press('Enter');
  await page.waitForTimeout(300);
  text = await outputText();
  check('clc clears the console', text.trim() === '');

  // History recall
  await input.fill('disp(1)');
  await input.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('disp(1)'), null, { timeout: 15000 });
  await input.fill('disp(2)');
  await input.press('Enter');
  await page.waitForFunction(() => {
    const t = document.body.innerText;
    return t.includes('disp(2)') && (t.match(/\n2\n|\n2$/) || t.includes('\n2'));
  }, null, { timeout: 15000 });
  await input.press('ArrowUp');
  check('ArrowUp recalls the most recent command', (await input.inputValue()) === 'disp(2)');
  await input.press('ArrowUp');
  check('ArrowUp again recalls the one before that', (await input.inputValue()) === 'disp(1)');
  await input.press('ArrowDown');
  check('ArrowDown moves forward through history', (await input.inputValue()) === 'disp(2)');
  await input.press('ArrowDown');
  check('ArrowDown past the newest entry clears the input', (await input.inputValue()) === '');

  // Clear button
  const clearButton = page.locator('button', { hasText: 'Clear' }).first();
  await clearButton.click();
  await page.waitForTimeout(200);
  text = await outputText();
  check('Clear button empties the console', text.trim() === '');

  // Multi-line continuation (Phase 2) has its own dedicated coverage in
  // t80-repl-multiline.js -- this file stays scoped to single-line usage.
  // A balanced one-liner block (for i=1:2, disp(i), end) still runs normally
  // as a single line, never entering continuation mode.
  const beforeBalanced = await outputText();
  await input.fill('for i = 1:2, disp(i), end');
  await input.press('Enter');
  await page.waitForFunction(
    ({ before, sel }) => {
      const pre = Array.from(document.querySelectorAll('pre')).find((p) => p.closest(sel));
      return !!pre && pre.innerText.length > before.length;
    },
    { before: beforeBalanced, sel: '.flex.h-full.flex-col.bg-app' },
    { timeout: 15000 },
  );
  check(
    'a balanced single-line block executes immediately, without entering continuation mode',
    (await input.getAttribute('placeholder')) === 'Type an Octave command…',
  );

  // Font size zoom affects the REPL input too
  const consoleHeader = page.locator('div.flex.flex-shrink-0.items-center.gap-2.border-b.border-line', { hasText: 'Command Window' });
  const consoleButtons = consoleHeader.locator('button');
  const count = await consoleButtons.count();
  const consoleIncrease = consoleButtons.nth(count - 2);
  const initialInputFontSize = await input.evaluate((el) => getComputedStyle(el).fontSize);
  for (let i = 0; i < 5; i++) await consoleIncrease.click();
  const zoomedInputFontSize = await input.evaluate((el) => getComputedStyle(el).fontSize);
  check('REPL input font size follows the existing console zoom controls', zoomedInputFontSize !== initialInputFontSize);

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
