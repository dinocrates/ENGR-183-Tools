// Partial Unit 1 verification against dev, deliberately excluding
// Run Tests: this project's dev/prod pipeline builds the WASM kernel (and
// the /engr183/tests/ harness content mounted into it) only from main and
// copies it into the dev deploy, so engr183.runTests('unit01') on dev
// still runs main's OLD checker until this merges. Only checks that don't
// depend on the kernel-mounted harness: File Browser contents, the
// retiredFiles hiding mechanism, and Run File (which executes the
// student's own file directly, untouched by the stale harness mount).
const { chromium } = require('playwright');

let pass = 0, fail = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (ok) pass++; else fail++;
}

async function waitReady(page, timeout = 60000) {
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout });
}

async function fileBrowserNames(page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('li span.flex-1.truncate')).map((s) => s.textContent),
  );
}

async function addFile(page, name) {
  await page.getByTitle('Add a new file').click();
  await page.locator('input[placeholder="newFile.m"]').fill(name);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground-dev/';

  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));
  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await waitReady(page);

  const initialFiles = await fileBrowserNames(page);
  check('fresh Unit 1 shows exactly one file: U01_OctaveSetupCheck.m',
    initialFiles.length === 1 && initialFiles[0] === 'U01_OctaveSetupCheck.m');

  const starterRow = page.locator('li', { hasText: 'U01_OctaveSetupCheck.m' });
  await starterRow.hover();
  const starterDeleteCount = await starterRow.locator('button[title="Delete U01_OctaveSetupCheck.m"]').count();
  check('U01_OctaveSetupCheck.m is protected (no delete icon)', starterDeleteCount === 0);

  const oldFunctionNames = ['addTwo.m', 'circleArea.m', 'greet.m'];
  for (const name of oldFunctionNames) {
    check(`old function file ${name} does not appear on fresh load`, !initialFiles.includes(name));
  }

  // --- Run File on the untouched starter: doesn't depend on the harness
  // mount, executes the student's own file directly ---
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Work check:'), null, { timeout: 30000 });
  const runFileText = await page.evaluate(() => document.querySelector('pre')?.textContent || '');
  check('Run File on untouched starter produces all 5 required lines', [
    'GNU Octave setup verified.',
    'Student: Replace with your first and last name',
    'Course: ENGR 183',
    'GNU Octave version:',
    'Work check: 75.0 J',
  ].every((line) => runFileText.includes(line)));

  // --- Simulate a returning user with the old retired files still present ---
  for (const name of oldFunctionNames) {
    await addFile(page, name);
  }
  await addFile(page, 'myHelper.m');
  await page.waitForTimeout(600);

  const afterAddFiles = await fileBrowserNames(page);
  check('all 3 retired-name files + the new extra file show up immediately after adding',
    oldFunctionNames.every((n) => afterAddFiles.includes(n)) && afterAddFiles.includes('myHelper.m'));

  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await waitReady(page);
  const afterReloadFiles = await fileBrowserNames(page);
  for (const name of oldFunctionNames) {
    check(`after reload, retired file ${name} is hidden`, !afterReloadFiles.includes(name));
  }
  check('after reload, the genuinely new extra file myHelper.m still shows', afterReloadFiles.includes('myHelper.m'));
  check('after reload, U01_OctaveSetupCheck.m still shows', afterReloadFiles.includes('U01_OctaveSetupCheck.m'));

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
