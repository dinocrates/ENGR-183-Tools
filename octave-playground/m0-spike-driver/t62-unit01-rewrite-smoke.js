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
  const base = 'http://localhost:4173/';

  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));
  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await waitReady(page);

  // --- 1. Fresh Unit 1 shows only the new starter, no delete icon on it ---
  const initialFiles = await fileBrowserNames(page);
  check('fresh Unit 1 shows exactly one file: U01_OctaveSetupCheck.m',
    initialFiles.length === 1 && initialFiles[0] === 'U01_OctaveSetupCheck.m');
  const starterRow = page.locator('li', { hasText: 'U01_OctaveSetupCheck.m' });
  await starterRow.hover();
  const starterDeleteCount = await starterRow.locator('button[title="Delete U01_OctaveSetupCheck.m"]').count();
  check('U01_OctaveSetupCheck.m is protected (no delete icon)', starterDeleteCount === 0);

  const oldFunctionNames = ['addTwo.m', 'circleArea.m', 'greet.m'];
  for (const name of oldFunctionNames) {
    check(`old function file ${name} does not appear`, !initialFiles.includes(name));
  }

  // --- 2. Untouched starter: 5/8 with a useful personalization failure ---
  const runTestsBtn = page.getByText('Run Tests', { exact: true });
  await runTestsBtn.click();
  await page.waitForFunction(() => document.body.innerText.includes('Score:'), null, { timeout: 60000 });
  let cmdText = await page.evaluate(() => document.querySelector('pre')?.textContent || '');
  console.log('--- Command Window after Run Tests (untouched) ---\n' + cmdText + '\n--- end ---');
  check('untouched starter scores 5/8', cmdText.includes('Score: 5/8'));
  check('failure message names the Name placeholder', cmdText.includes('Replace the Name comment placeholder'));

  // --- 3. Simulate a returning user with the OLD retired files still in
  // their drive (via the Add File UI -- exercises the exact same
  // contents-drive code path a real leftover IndexedDB entry would) ---
  for (const name of oldFunctionNames) {
    await addFile(page, name);
  }
  await addFile(page, 'myHelper.m'); // a genuinely new extra file, should NOT be hidden
  await page.waitForTimeout(600); // let the 500ms autosave debounce flush

  const afterAddFiles = await fileBrowserNames(page);
  check('all 3 retired-name files + the new extra file show up immediately after adding',
    oldFunctionNames.every((n) => afterAddFiles.includes(n)) && afterAddFiles.includes('myHelper.m'));

  // --- 4. Reload: retired files must NOT resurface, genuine extra must persist ---
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await waitReady(page);
  const afterReloadFiles = await fileBrowserNames(page);
  for (const name of oldFunctionNames) {
    check(`after reload, retired file ${name} is hidden (not deleted, just not shown)`, !afterReloadFiles.includes(name));
  }
  check('after reload, the genuinely new extra file myHelper.m still shows', afterReloadFiles.includes('myHelper.m'));
  check('after reload, U01_OctaveSetupCheck.m still shows', afterReloadFiles.includes('U01_OctaveSetupCheck.m'));

  // clean up myHelper.m so it doesn't interfere with later steps
  const helperRow = page.locator('li', { hasText: 'myHelper.m' });
  await helperRow.hover();
  await helperRow.locator('button[title="Delete myHelper.m"]').click();
  await page.getByText('Delete file', { exact: true }).click();
  await page.waitForTimeout(300);

  // --- 5. Personalize the starter, confirm 8/8 ---
  await starterRow.click();
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  const personalized = [
    "% ENGR 183 GNU Octave Setup Verification",
    "% Name: Alex Rivera",
    "% Date: 2026-02-01",
    "",
    "clear;",
    "clc;",
    "",
    "student_name = 'Alex Rivera';",
    "course_number = 183;",
    "force_N = 25;",
    "distance_m = 3;",
    "work_J = force_N * distance_m;",
    "octave_version = version();",
    "",
    "disp('GNU Octave setup verified.');",
    "fprintf('Student: %s\\n', student_name);",
    "fprintf('Course: ENGR %d\\n', course_number);",
    "fprintf('GNU Octave version: %s\\n', octave_version);",
    "fprintf('Work check: %.1f J\\n', work_J);",
  ].join('\n');
  await page.keyboard.insertText(personalized);
  await page.waitForTimeout(600);

  await runTestsBtn.click();
  await page.waitForFunction(() => document.body.innerText.includes('Score:'), null, { timeout: 60000 });
  cmdText = await page.evaluate(() => document.querySelector('pre')?.textContent || '');
  check('personalized starter scores 8/8', cmdText.includes('Score: 8/8'));

  // --- 6. Run File shows the exact 5 lines, personalized + real version ---
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(
    () => document.body.innerText.includes('Work check:') || document.body.innerText.includes('Execution exception'),
    null, { timeout: 60000 },
  );
  cmdText = await page.evaluate(() => document.querySelector('pre')?.textContent || '');
  if (process.env.T62_DEBUG) console.log('--- Command Window after Run File (personalized) ---\n' + cmdText + '\n--- end ---');
  check('Run File output has all 5 required lines', [
    'GNU Octave setup verified.',
    'Student: Alex Rivera',
    'Course: ENGR 183',
    'GNU Octave version:',
    'Work check: 75.0 J',
  ].every((line) => cmdText.includes(line)));

  // --- 7. Reset restores the exact original starter ---
  await page.getByTitle('Discard changes to the current file, restoring the original starter').click();
  await page.locator('button.bg-red-600', { hasText: 'Reset file' }).click();
  await page.waitForTimeout(300);
  // Monaco renders spaces in .view-line text as U+00A0, not ASCII space
  // (confirmed in t61-syntax-highlighting.js) -- normalize before matching.
  const resetLines = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.view-line')).map((l) => l.textContent.replace(/ /g, ' ')),
  );
  const resetText = resetLines.join('\n');
  check('reset restores the placeholder Name comment', resetText.includes('Replace with your first and last name'));
  check('reset discards the personalized name', !resetText.includes('Alex Rivera'));

  // --- 8. A single personalized copy via Add File is preferred by the checker ---
  await addFile(page, 'U01_OctaveSetupCheck_Rivera');
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText(personalized);
  await page.waitForTimeout(600);
  await runTestsBtn.click();
  await page.waitForFunction(() => document.body.innerText.includes('Score:'), null, { timeout: 60000 });
  cmdText = await page.evaluate(() => document.querySelector('pre')?.textContent || '');
  check('personalized copy (U01_OctaveSetupCheck_Rivera.m) is preferred: 8/8', cmdText.includes('Score: 8/8'));

  const filesAfterCopy = await fileBrowserNames(page);
  check('personalized copy appears in File Browser', filesAfterCopy.includes('U01_OctaveSetupCheck_Rivera.m'));

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
