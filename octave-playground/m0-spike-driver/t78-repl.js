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

  // Kernel busy: input disables mid-command. The round trip can be fast
  // (in-process WASM, no network), so racing a single fixed-delay check
  // against it is flaky -- wait for the "Kernel busy…" placeholder to
  // actually attach instead, which polls continuously and reliably catches
  // even a brief disabled window.
  await input.fill('x = 99');
  const enterPromise = input.press('Enter');
  const sawBusy = await page
    .waitForSelector('input[placeholder="Kernel busy…"]', { timeout: 2000 })
    .then(() => true)
    .catch(() => false);
  await enterPromise;
  await page.waitForFunction(() => document.body.innerText.includes('x = 99'), null, { timeout: 15000 });
  check('input disables while a REPL command is executing', sawBusy);
  check('input re-enables after the command finishes', await input.isEnabled());

  // Workspace panel reflects a REPL-defined variable
  await page.waitForTimeout(300);
  const workspaceText = await page.evaluate(() => document.body.innerText);
  check('Workspace panel updates after a REPL command (not just Run Tests/Run File)', workspaceText.includes('x') && workspaceText.includes('99'));

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

  // Unclosed block: friendly redirect, not a raw parser error
  await input.fill('for i = 1:3');
  await input.press('Enter');
  await page.waitForTimeout(300);
  text = await outputText();
  check(
    'unclosed block shows the friendly redirect instead of executing',
    text.includes("Multi-line blocks aren't supported") && !text.toLowerCase().includes('parse error'),
  );

  // A balanced one-liner block (for i=1:2, disp(i), end) still runs normally
  await clearButton.click();
  await input.fill('for i = 1:2, disp(i), end');
  await input.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('1') && document.body.innerText.includes('2'), null, { timeout: 15000 });
  text = await outputText();
  check('a balanced single-line block executes normally (not misdetected as unclosed)', !text.includes("Multi-line blocks aren't supported"));

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
