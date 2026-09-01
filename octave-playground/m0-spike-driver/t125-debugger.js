// The step debugger, end to end through the real UI: breakpoint in the
// gutter, Debug, land paused with the line highlighted + DebugBar, inspect
// the paused frame in the Workspace panel, step, continue, finish.
//
//   node t125-debugger.js [baseUrl]
const { chromium } = require('playwright');
const arg = process.argv[2];
const BASE = arg && !arg.startsWith('--') ? arg : 'http://localhost:4173/';

let pass = 0, fail = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok && detail !== undefined) console.log('  ' + String(detail).replace(/\n/g, '\n  '));
  ok ? pass++ : fail++;
};

const FN = `function code = classify_temperature(temp_C, warning_C, shutdown_C)
  midpoint = (warning_C + shutdown_C) / 2;
  hot = temp_C >= warning_C;
  crit = temp_C >= shutdown_C;
  code = double(hot) + double(crit);
end
`;
const MAIN = `code = classify_temperature(96, 80, 95);
fprintf("code = %d\\n", code);
`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => { if (/\[dbg\]|error/i.test(m.text())) console.log('  browser>', m.text()); });
  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
    localStorage.setItem('engr183-e2e', '1'); // enables window.__bp test hook
  });
  await page.goto(BASE + '?unit=u04-gp04-thermal-monitor', { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 200000 });
  await page.waitForTimeout(800);

  async function setFile(tab, body) {
    await page.getByText(tab, { exact: true }).first().click();
    await page.click('.monaco-editor');
    await page.keyboard.press('Control+A'); await page.keyboard.press('Delete');
    await page.keyboard.insertText(body);
    await page.waitForTimeout(700);
  }
  await setFile('classify_temperature.m', FN);
  await setFile('U04_GP04_ThermalMonitor_Starter.m', MAIN);

  // --- breakpoint on line 3 of the function, via the gutter, then verified
  await page.getByText('classify_temperature.m', { exact: true }).first().click();
  await page.waitForTimeout(400);
  const box = await page.locator('.monaco-editor').first().boundingBox();
  await page.mouse.click(box.x + 6, box.y + 50); // ~line 3 glyph margin
  await page.waitForTimeout(500);
  let bp = await page.evaluate(() => window.__bp.get()['classify_temperature.m'] || []);
  // fall back to the deterministic hook if the pixel-click missed
  if (!bp.includes(3)) {
    await page.evaluate(() => {
      const b = window.__bp.get()['classify_temperature.m'] || [];
      b.forEach((l) => window.__bp.toggle('classify_temperature.m', l));
      window.__bp.toggle('classify_temperature.m', 3);
    });
    await page.waitForTimeout(300);
    bp = await page.evaluate(() => window.__bp.get()['classify_temperature.m'] || []);
  }
  check('a breakpoint is set on line 3 of classify_temperature.m', bp.includes(3), JSON.stringify(bp));
  check('breakpoint dot renders in the gutter', (await page.locator('.engr183-bp-glyph').count()) >= 1);

  // --- Debug the main script
  await page.getByText('U04_GP04_ThermalMonitor_Starter.m', { exact: true }).first().click();
  await page.getByRole('button', { name: /^Debug$/ }).click();

  const gotPaused = await page.getByText('Paused', { exact: true })
    .waitFor({ state: 'visible', timeout: 30000 }).then(() => true).catch(() => false);
  check('Debug run pauses at the breakpoint', gotPaused);
  if (!gotPaused) console.log('output:', await page.evaluate(() => document.querySelector('pre')?.innerText));

  const loc = () => page.locator('div.bg-accent\\/10 code').first().textContent().catch(() => '');
  check('DebugBar names the paused location (classify_temperature:3)', /classify_temperature:3/.test((await loc()) || ''), await loc());

  // switch to the function file to see the current-line highlight
  await page.getByText('classify_temperature.m', { exact: true }).first().click();
  await page.waitForTimeout(300);
  check('paused line is highlighted in the editor', (await page.locator('.engr183-debug-line').count()) >= 1);

  await page.waitForTimeout(1500);
  const ws = () => page.evaluate(() => document.querySelector('table')?.innerText || '');
  check('Workspace shows a paused-frame local that has run (midpoint)', /midpoint/.test(await ws()), await ws());
  check('Workspace does not show a local that has not run yet (crit)', !/\bcrit\b/.test(await ws()), await ws());

  // --- staying paused past the 60s "kernel stuck" watchdog must NOT end
  // the session (the kernel is waiting on us, not hung)
  if (process.argv.includes('--slow')) {
    await page.waitForTimeout(65000);
    check('still paused after 65s (watchdog suspended while waiting on us)',
      (await page.getByText('Paused', { exact: true }).count()) > 0);
  }

  // --- Step over
  await page.getByRole('button', { name: /^↷ Step$/ }).click();
  await page.waitForTimeout(2500);
  check('Step advances to line 4', /classify_temperature:4/.test((await loc()) || ''), await loc());
  check('Workspace updates as we step (hot now present)', /\bhot\b/.test(await ws()), await ws());

  // --- Continue to the end
  await page.getByRole('button', { name: /Continue/ }).click();
  const done = await page
    .waitForFunction(() => document.body.innerText.includes('code = 2') && !document.body.innerText.includes('Paused'),
      null, { timeout: 15000 })
    .then(() => true).catch(() => false);
  check('Continue runs to completion (code = 2), DebugBar gone', done);

  const input = page.getByPlaceholder(/Type an Octave command/);
  await input.fill('3 + 4'); await input.press('Enter');
  const usable = await page.waitForFunction(() => document.body.innerText.includes('7'), null, { timeout: 10000 })
    .then(() => true).catch(() => false);
  check('kernel is usable after the debug session', usable);
  check('no uncaught page errors', pageErrors.length === 0, pageErrors.join('\n'));

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message, e.stack); process.exit(1); });
