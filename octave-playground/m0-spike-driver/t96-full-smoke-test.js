// Full end-to-end smoke test: one continuous session walking the real
// student/instructor journey against production, not isolated per-feature
// checks. Complements the existing granular test suite by catching
// integration issues (e.g. does theme+REPL+figures all work together in
// one session) that per-ticket tests, run in isolation, wouldn't surface.
const { chromium } = require('playwright');

let pass = 0, fail = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (ok) pass++; else fail++;
}

const BASE = process.argv[2] || 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground/';
console.log(`Smoke testing: ${BASE}\n`);

(async () => {
  const browser = await chromium.launch();
  const consoleErrors = [];
  const pageErrors = [];

  // ===================================================================
  // PART A: fresh first-visit experience (persistence warning + onboarding)
  // ===================================================================
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => pageErrors.push(e.message));

  console.log('--- First-visit flow ---');
  await page.goto(BASE, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);
  let text = await page.evaluate(() => document.body.innerText);
  check('persistence warning shows on a fresh visit', text.includes('your work lives in this browser'));
  await page.getByText('Got it', { exact: true }).click();
  await page.waitForTimeout(300);
  text = await page.evaluate(() => document.body.innerText);
  check('onboarding overlay appears next', text.includes('Quick orientation'));
  await page.getByText("Let's go", { exact: true }).click();
  await page.waitForTimeout(300);
  text = await page.evaluate(() => document.body.innerText);
  check('unit index visible after both modals dismissed', text.includes('Pick a unit'));
  check('Unit 1 card is present', text.includes('Unit 1'));
  check('Scratch Pad card is present', text.includes('Scratch Pad'));

  // ===================================================================
  console.log('\n--- Unit 1: kernel startup, Run Tests, Run File ---');
  await page.getByText('Unit 1', { exact: false }).first().click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 90000 });
  await page.waitForTimeout(500);
  text = await page.evaluate(() => document.body.innerText);
  check('kernel reaches Ready', text.includes('Ready'));
  check('File Browser shows the starter file', text.includes('.m'));
  check('Problem Statement panel shows unit content', text.includes('Personalize') || text.includes('GNU Octave'));

  await page.getByText('Run Tests', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Score:'), null, { timeout: 30000 });
  text = await page.evaluate(() => document.body.innerText);
  check('Run Tests produces a rubric report', text.includes('[ PASS ]') || text.includes('[ FAIL ]'));
  check('rubric report has a score line', text.includes('Score:'));

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("disp('smoke test run file');\n");
  const beforeRunFile = await page.evaluate(() => document.body.innerText);
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('smoke test run file'), null, { timeout: 20000 });
  text = await page.evaluate(() => document.body.innerText);
  check('Run File output persists alongside the earlier Run Tests report (no auto-clear)', text.includes('Score:') && text.includes('smoke test run file'));

  // ===================================================================
  console.log('\n--- REPL: single-line and multi-line ---');
  const input = page.getByPlaceholder(/Type an Octave command|Continue the block/);
  await input.fill('disp(21 * 2)');
  await input.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('42'), null, { timeout: 15000 });
  text = await page.evaluate(() => document.body.innerText);
  check('REPL single-line command executes and echoes', text.includes('>> disp(21 * 2)') && text.includes('42'));

  await input.fill('for i = 1:3');
  await input.press('Enter');
  await page.waitForTimeout(300);
  check('REPL multi-line continuation prompt appears', await page.locator('[class*="bg-raised/40"]').isVisible());
  await input.fill('disp(i)');
  await input.press('Enter');
  await page.waitForTimeout(300);
  await input.fill('end');
  const beforeLoop = await page.evaluate(() => document.body.innerText);
  await input.press('Enter');
  await page.waitForFunction(
    (before) => document.body.innerText.length > before.length,
    beforeLoop,
    { timeout: 15000 },
  );
  check('REPL multi-line block executes once closed', !(await page.locator('[class*="bg-raised/40"]').isVisible()));

  await page.waitForTimeout(1000);
  const workspaceTable = await page.evaluate(() => {
    const t = document.querySelector('table');
    return t ? t.innerText : '';
  });
  check('Workspace panel reflects REPL-defined variables', workspaceTable.includes('i'));

  // ===================================================================
  console.log('\n--- Figures ---');
  const clearBtn = page.locator('button', { hasText: 'Clear' }).first();
  await clearBtn.click();
  await page.waitForTimeout(200);
  await input.fill("plot(1:10, (1:10).^2); title('smoke test plot');");
  await input.press('Enter');
  await page.waitForFunction(() => document.body.innerText.includes('Figure'), null, { timeout: 20000 });
  await page.waitForTimeout(1500);
  const hasCanvas = await page.evaluate(() => !!document.querySelector('.js-plotly-plot'));
  check('a REPL-triggered plot() opens a Figure window and renders', hasCanvas);
  const closeBtn = page.locator('[title="Close"], button:has-text("✕")').first();
  await closeBtn.click().catch(() => {});

  // ===================================================================
  console.log('\n--- Themes ---');
  for (const label of ['☀️ Light', '⚡ High Contrast', '🕹️ 8-Bit Retro', '💊 Matrix', '🌙 Dark']) {
    await page.getByLabel('Theme').selectOption({ label });
    await page.waitForTimeout(250);
  }
  const finalTheme = await page.evaluate(() => document.documentElement.dataset.theme ?? 'dark');
  check('theme cycle completes and lands back on dark with no errors', finalTheme === 'dark' || finalTheme === undefined);

  // ===================================================================
  console.log('\n--- Font size controls ---');
  const editorButtons = page.locator('.flex.items-center.border-b.border-line.bg-surface button');
  const editorIncrease = editorButtons.last();
  const before1 = await page.evaluate(() => document.querySelector('.monaco-editor .view-lines')?.style.fontSize || getComputedStyle(document.querySelector('.monaco-editor .view-lines')).fontSize);
  await editorIncrease.click();
  await page.waitForTimeout(200);
  const after1 = await page.evaluate(() => getComputedStyle(document.querySelector('.monaco-editor .view-lines')).fontSize);
  check('editor font-size zoom control works', before1 !== after1);

  // ===================================================================
  console.log('\n--- Download ---');
  const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);
  await page.getByText('Download File', { exact: true }).click();
  const download = await downloadPromise;
  check('Download File triggers a real download', download !== null);

  // ===================================================================
  console.log('\n--- Back to index, Scratch Pad ---');
  await page.getByText('All units', { exact: false }).click();
  await page.waitForTimeout(500);
  text = await page.evaluate(() => document.body.innerText);
  check('returns to unit index', text.includes('Pick a unit'));

  await page.getByText('Scratch Pad', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 90000 });
  text = await page.evaluate(() => document.body.innerText);
  check('Scratch Pad opens with Run Tests hidden', !text.includes('Run Tests') || (await page.getByText('Run Tests', { exact: true }).count()) === 0);
  check('Scratch Pad has Run File available', text.includes('Run File'));

  await page.close();

  // ===================================================================
  console.log('\n--- Deep link (fresh session) ---');
  const page2 = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page2.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page2.on('pageerror', (e) => pageErrors.push(e.message));
  await page2.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
  });
  await page2.goto(BASE + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page2.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 90000 });
  text = await page2.evaluate(() => document.body.innerText);
  check('deep link ?unit=unit01 skips the index and loads the unit directly', text.includes('OR-01') || text.includes('Setup'));
  await page2.close();

  // ===================================================================
  console.log('\n--- Console/page errors across the whole session ---');
  check('no uncaught page errors during the entire smoke test', pageErrors.length === 0);
  if (pageErrors.length > 0) console.log('  page errors:', pageErrors);
  check('no console.error output during the entire smoke test', consoleErrors.length === 0);
  if (consoleErrors.length > 0) console.log('  console errors:', consoleErrors);

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message, e.stack); process.exit(1); });
