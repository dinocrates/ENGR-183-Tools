const { chromium } = require('playwright');

let pass = 0, fail = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (ok) pass++; else fail++;
}

const BASE = process.argv[2] || 'http://localhost:4173/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
  });
  await page.goto(BASE + '?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 90000 });
  await page.waitForTimeout(500);

  function outputText() {
    return page.evaluate(() => {
      const pre = Array.from(document.querySelectorAll('pre')).find((p) => p.closest('.flex.h-full.flex-col.bg-app'));
      return pre ? pre.innerText : null;
    });
  }
  const stopButton = page.getByText('Stop', { exact: true });

  check('Stop button is not present while idle', (await stopButton.count()) === 0);

  // Define a variable, then kick off a slow loop -- long enough to reliably
  // click Stop mid-execution (calibrated: ~26k-45k iter/sec under this WASM
  // interpreter, see t78-repl.js).
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("marker = 123;\nx = 0;\nfor k = 1:5e5\n  x = x + 1;\nend\ndisp(x)\n");
  await page.getByText('Run File', { exact: true }).click();

  const stopAppeared = await stopButton.waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false);
  check('Stop button appears once the kernel is busy', stopAppeared);

  const t0 = Date.now();
  await stopButton.click();

  const settled = await page
    .waitForFunction(() => {
      const el = Array.from(document.querySelectorAll('span')).find((s) => /Ready|Running|Starting/.test(s.textContent || ''));
      return el && el.textContent === 'Ready';
    }, null, { timeout: 20000 })
    .then(() => true)
    .catch(() => false);
  const elapsed = Date.now() - t0;
  check('clicking Stop settles the app back to Ready well under the 60s timeout', settled && elapsed < 20000);
  console.log(`  (settled in ${elapsed}ms)`);

  const text = await outputText();
  check('output explains the kernel was stopped/restarted', text.includes('Stopped') || text.includes('restarting'));
  check('the interrupted loop never got to print its result (500000)', !text.includes('500000'));

  const workspaceText = await page.evaluate(() => {
    const t = document.querySelector('table');
    return t ? t.innerText : '';
  });
  check('Workspace panel is cleared after Stop (marker variable gone)', !workspaceText.includes('marker'));

  check('Stop button disappears again once idle', (await stopButton.count()) === 0);

  // Kernel must be genuinely usable again, not just visually reset.
  const input = page.getByPlaceholder(/Type an Octave command|Continue the block/);
  const usable = await input.isEnabled().catch(() => false);
  check('REPL input is enabled again after Stop', usable);
  await input.fill('disp(6 * 7)');
  await input.press('Enter');
  const recovered = await page.waitForFunction(() => document.body.innerText.includes('42'), null, { timeout: 15000 }).then(() => true).catch(() => false);
  check('a fresh kernel actually works after Stop (new command executes correctly)', recovered);

  // File edits must survive -- Stop only touches kernel state, not the
  // browser-side file bridge. Two Monaco rendering quirks matter here: it
  // virtualizes rendering (only visible lines exist in the DOM, hence the
  // scroll-to-top), and it renders spaces as U+00A0 (non-breaking space),
  // not a plain U+0020 space -- a literal-string match against normal
  // spaces silently fails even though the content is actually correct, so
  // normalize before comparing (confirmed via char-code dump, not a guess).
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+Home');
  const editorText = await page.evaluate(() => {
    const el = document.querySelector('.monaco-editor .view-lines');
    return el ? el.innerText.replace(/ /g, ' ') : '';
  });
  check('the file content in the editor is untouched by Stop', editorText.includes('marker = 123'));

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
