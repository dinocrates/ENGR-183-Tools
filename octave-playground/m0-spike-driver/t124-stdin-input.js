// Regression test: Octave's input() works. Before this, calling input()
// hung the kernel (allow_stdin was false and nothing answered the
// input_request) -- see DESIGN.md T3.28. Now the Command Window swaps to
// "answer the prompt" mode and the value is sent to the kernel.
//
//   node t124-stdin-input.js [baseUrl]
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:4173/';

let pass = 0, fail = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok && detail !== undefined) console.log('  ' + String(detail).replace(/\n/g, '\n  '));
  ok ? pass++ : fail++;
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
  });
  await page.goto(BASE + '?unit=scratch', { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 200000 });
  await page.waitForTimeout(800);

  const input = page.getByPlaceholder(/Type an Octave command|Continue the block/);
  const out = () =>
    page.evaluate(() => {
      const pre = Array.from(document.querySelectorAll('pre')).find((p) =>
        p.closest('.flex.h-full.flex-col.bg-app'),
      );
      return pre ? pre.innerText : '';
    });

  // --- 1. input() at the REPL
  await input.fill('age = input("Your age: ")');
  await input.press('Enter');

  const promptField = page.getByPlaceholder(/Your age.*answer/i);
  const gotPrompt = await promptField
    .waitFor({ state: 'visible', timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  check('Command Window shows an answerable prompt for input()', gotPrompt);
  check('the prompt field is enabled while the kernel is "busy"', gotPrompt && (await promptField.isEnabled()));
  check('prompt indicator switches to "?"', (await page.locator('span.font-mono', { hasText: '?' }).count()) > 0);

  await promptField.fill('27');
  await promptField.press('Enter');
  const gotAge = await page
    .waitForFunction(() => document.body.innerText.includes('age = 27'), null, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  check('the answer reaches Octave (age = 27)', gotAge, await out());

  // input is back to normal command mode
  await page.waitForTimeout(500);
  check(
    'Command Window returns to normal command mode afterward',
    (await input.getAttribute('placeholder')) === 'Type an Octave command…',
  );

  // --- 2. input() inside a Run File script
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText('name = input("Name? ", "s");\nfprintf("hello %s\\n", name);\n');
  await page.waitForTimeout(700);
  await page.getByText('Run File', { exact: true }).click();

  const p2 = page.getByPlaceholder(/Name.*answer/i);
  const got2 = await p2.waitFor({ state: 'visible', timeout: 15000 }).then(() => true).catch(() => false);
  check('input() also works from a Run File script', got2);
  if (got2) {
    await p2.fill('Ada');
    await p2.press('Enter');
    const gotHello = await page
      .waitForFunction(() => document.body.innerText.includes('hello Ada'), null, { timeout: 15000 })
      .then(() => true)
      .catch(() => false);
    check('Run File script continues past input() with the answer', gotHello, await out());
  }

  // --- 3. a normal command with no input() is unaffected
  await page.waitForTimeout(500);
  await input.fill('disp(6 * 7)');
  await input.press('Enter');
  const got42 = await page
    .waitForFunction(() => document.body.innerText.includes('42'), null, { timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  check('ordinary commands still work normally', got42);

  check('no uncaught page errors', pageErrors.length === 0, pageErrors.join('\n'));

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e.message, e.stack);
  process.exit(1);
});
