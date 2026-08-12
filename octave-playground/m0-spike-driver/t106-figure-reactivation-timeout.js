// Regression test for a real, intermittent xeus-octave kernel bug found via
// Stephen's own smoke-test script: re-calling figure(N) on an already-open
// figure sometimes (~1 in 4-5 tries, confirmed via raw kernel message dumps
// in m0-spike-driver history) makes the kernel never send
// update_display_data or execute_reply at all, even though Octave's own
// interpreter finishes the script correctly. Without session.ts's 60s
// execute() timeout, this hangs the app forever (status stuck 'running',
// Command Window input stuck disabled) -- a page reload was the only
// recovery. The dropped kernel message can't be fixed from this repo (it's
// the prebuilt xeus-octave WASM binary, not this app's own source); this
// test instead verifies the mitigation: the app never stays permanently
// stuck, whether or not the bug happens to trigger on a given run.
//
// This can't reliably force the underlying kernel race, so it runs the
// trigger pattern several times and asserts recovery within a bound
// (comfortably above the 60s timeout) every time -- slow by design, not
// meant for a tight regression loop.
const { chromium } = require('playwright');

let pass = 0, fail = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (ok) pass++; else fail++;
}

const BASE = process.argv[2] || 'http://localhost:4173/';
const ATTEMPTS = Number(process.argv[3] || 3);

const SCRIPT = `
x1 = linspace(0, 2*pi, 50);
y1 = sin(x1);
figure(1);
plot(x1, y1, 'LineWidth', 2);
title('Figure 1: Sine Wave');
figure(1);
hold on;
plot(x1, cos(x1), '--', 'LineWidth', 2);
legend('sin(x)', 'cos(x)');
hold off;
disp('done');
`;

(async () => {
  const browser = await chromium.launch();

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    console.log(`\n--- attempt ${attempt}/${ATTEMPTS} ---`);
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.addInitScript(() => {
      localStorage.setItem('engr183-persistence-ack', '1');
      localStorage.setItem('engr183-onboarding-seen', '1');
    });
    await page.goto(BASE + '?unit=scratch', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 90000 });
    await page.waitForTimeout(500);
    await page.click('.monaco-editor');
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(SCRIPT);
    await page.getByText('Run File', { exact: true }).click();

    // Must settle (either genuinely complete, or the timeout mitigation
    // fires) well within 60s + slack -- never permanently "Running…".
    const settled = await page
      .waitForFunction(() => {
        const el = Array.from(document.querySelectorAll('span')).find((s) => /Ready|Error/.test(s.textContent || ''));
        return !!el;
      }, null, { timeout: 70000 })
      .then(() => true)
      .catch(() => false);
    check(`attempt ${attempt}: app settles to Ready or Error within 70s (never stuck at Running)`, settled);

    const inputUsable = await page
      .getByPlaceholder(/Type an Octave command|Continue the block/)
      .isEnabled()
      .catch(() => false);
    check(`attempt ${attempt}: REPL input is usable again afterward`, inputUsable);

    await page.close();
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
