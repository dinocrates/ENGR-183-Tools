// Regression test (T-error-origin): when a student's program spans several
// function files and one of them raises an error, the Command Window must
// name the file(s) and line(s) the error came from -- not just the bare
// message, and not the message printed twice.
//
// Before the fix, session.ts dropped the kernel error message's `traceback`
// (which carries Octave's "error: called from / <fn> at line N" block) and
// printed only `ename: evalue` -- and, because the iopub `error` message and
// the `execute_reply` order ename/evalue differently, printed it twice in
// two different manglings. See src/kernel/formatError.ts and
// m0-spike-driver/t121-format-kernel-error.js (the pure-function unit test).
//
// Runs against the dev deploy by default (the fix lands there first):
//   node t120-error-origin.js [baseUrl] [unit]
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground-dev/';
const UNIT = process.argv[3] || 'u04-gp04-thermal-monitor';

let pass = 0, fail = 0;
function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok && detail !== undefined) console.log('  ' + String(detail).replace(/\n/g, '\n  '));
  ok ? pass++ : fail++;
}

const BUGGY_CLASSIFY = `function code = classify_temperature(temp_C, warning_C, shutdown_C)
  % deliberately buggy for the spike: nonconformant add on line 5
  a = [1 2 3];
  b = [1 2];
  code = a + b;
  code = temp_C > warning_C;
end
`;

const CALLER_ANALYZE = `function [status_codes, first_warning_index, first_shutdown_index] = analyze_thermal_log(core_temps_C, warning_C, shutdown_C)
  status_codes = zeros(size(core_temps_C));
  for k = 1:numel(core_temps_C)
    status_codes(k) = classify_temperature(core_temps_C(k), warning_C, shutdown_C);
  end
  first_warning_index = find(status_codes >= 1, 1);
  first_shutdown_index = find(status_codes >= 2, 1);
end
`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
    // Raw tap on Worker -> main messages, for diagnostics on failure.
    window.__rawHits = [];
    const OrigWorker = window.Worker;
    window.Worker = new Proxy(OrigWorker, {
      construct(target, args) {
        const w = new target(...args);
        w.addEventListener('message', (ev) => {
          let s;
          try { s = JSON.stringify(ev.data); } catch { s = String(ev.data); }
          if (s && /traceback|called from/i.test(s)) window.__rawHits.push(s.slice(0, 4000));
        });
        return w;
      },
    });
  });

  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  console.log(`\n== ${BASE}?unit=${UNIT}`);
  await page.goto(`${BASE}?unit=${UNIT}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 120000 });
  await page.waitForTimeout(800);

  async function replaceFile(fileName, body) {
    await page.getByText(fileName, { exact: true }).first().click();
    await page.waitForTimeout(200);
    await page.click('.monaco-editor');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.insertText(body);
    await page.waitForTimeout(800); // autosave debounce is 500ms
  }
  await replaceFile('classify_temperature.m', BUGGY_CLASSIFY);
  await replaceFile('analyze_thermal_log.m', CALLER_ANALYZE);

  function outputText() {
    return page.evaluate(() => {
      const pre = Array.from(document.querySelectorAll('pre')).find((p) => p.closest('.flex.h-full.flex-col.bg-app'));
      return pre ? pre.innerText : '';
    });
  }

  const input = page.getByPlaceholder(/Type an Octave command|Continue the block/);

  // --- Nested call: analyze_thermal_log -> classify_temperature (throws).
  await input.fill('analyze_thermal_log([62 96], 80, 95)');
  await input.press('Enter');
  await page.waitForFunction(
    () => (document.body.innerText.match(/called from/g) || []).length >= 1,
    null,
    { timeout: 20000 },
  ).catch(() => {});
  await page.waitForTimeout(1500);

  const out = await outputText();
  const errBlock = out.slice(out.lastIndexOf('>> analyze_thermal_log'));
  console.log('--- Command Window (last command) ---\n' + errBlock + '\n---');

  check('shows the Octave error message', /error:\s*operator \+: nonconformant arguments/.test(errBlock), errBlock);
  check('shows "error: called from"', /error: called from/.test(errBlock));
  check('names classify_temperature with its line', /classify_temperature at line 5\b/.test(errBlock), errBlock);
  check('names the calling file analyze_thermal_log with its line', /analyze_thermal_log at line 4\b/.test(errBlock), errBlock);
  check('hides the REPL/eval wrapper frame (cell[N])', !/cell\[\d+\]/.test(errBlock), errBlock);
  check(
    'does not print the error message twice',
    (errBlock.match(/nonconformant arguments \(op1 is 1x3/g) || []).length === 1,
    errBlock,
  );
  check('no "Execution exception:" leakage in the shown message', !/Execution exception/.test(errBlock), errBlock);
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.join('\n'));

  if (fail > 0) {
    const hits = await page.evaluate(() => window.__rawHits || []);
    console.log(`\n-- raw traceback hits (${hits.length}) --`);
    hits.forEach((h) => console.log(h));
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message, e.stack); process.exit(1); });
