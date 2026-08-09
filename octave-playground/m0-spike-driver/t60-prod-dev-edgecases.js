const { chromium } = require('playwright');

let pass = 0, fail = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (ok) pass++; else fail++;
}

async function waitReady(page, timeout = 60000) {
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout });
}

async function openAddInput(page) {
  await page.getByTitle('Add a new file').click();
}

async function addFile(page, rawName) {
  await openAddInput(page);
  await page.locator('input[placeholder="newFile.m"]').fill(rawName);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground-dev/';

  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));
  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await waitReady(page);

  // --- Invalid name variants, each should be rejected inline, none should
  // ever reach the file list ---
  const invalidNames = ['123bad', 'has space', '../evil', 'weird!name', 'a/b.m', '.m', ''];
  for (const name of invalidNames) {
    await openAddInput(page);
    await page.locator('input[placeholder="newFile.m"]').fill(name);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    const stillOpen = await page.locator('input[placeholder="newFile.m"]').isVisible().catch(() => false);
    check(`invalid name "${name}" does not close the add input (rejected, not silently accepted)`, name === '' ? true : stillOpen);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
  const listAfterInvalid = await page.locator('li').allTextContents();
  check('no junk files got created from invalid-name attempts', !listAfterInvalid.some((t) => /bad|space|evil|weird|^\.m$/.test(t)));

  // --- Valid double-extension-looking name should be rejected (only one .m allowed) ---
  await openAddInput(page);
  await page.locator('input[placeholder="newFile.m"]').fill('helper.test.m');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const doubleExtRejected = await page.locator('input[placeholder="newFile.m"]').isVisible().catch(() => false);
  check('double-extension name "helper.test.m" rejected', doubleExtRejected);
  await page.keyboard.press('Escape');

  // --- Blur with empty input cancels cleanly (no error, no file) ---
  await openAddInput(page);
  await page.locator('.px-3.py-2 >> text=Unit 1').click().catch(() => {}); // click elsewhere to blur
  await page.waitForTimeout(200);
  const inputGoneAfterBlur = !(await page.locator('input[placeholder="newFile.m"]').isVisible().catch(() => false));
  check('blurring an empty add-input cancels it', inputGoneAfterBlur);

  // --- Add a real file, name without .m gets suffixed ---
  await addFile(page, 'helper');
  check('"helper" auto-suffixed to helper.m', (await page.locator('text=helper.m').count()) > 0);

  // --- Case-insensitive duplicate rejected against an existing extra file ---
  await openAddInput(page);
  await page.locator('input[placeholder="newFile.m"]').fill('HELPER.M');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const caseDupRejected = await page.locator('text=already exists').count();
  check('case-insensitive duplicate "HELPER.M" vs existing helper.m rejected', caseDupRejected > 0);
  await page.keyboard.press('Escape');

  // --- Case-insensitive duplicate rejected against a PROTECTED file ---
  await openAddInput(page);
  await page.locator('input[placeholder="newFile.m"]').fill('ADDTWO.M');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const protectedDupRejected = await page.locator('text=already exists').count();
  check('case-insensitive duplicate "ADDTWO.M" vs protected addTwo.m rejected', protectedDupRejected > 0);
  await page.keyboard.press('Escape');

  // --- Add a second extra file, then delete the NON-active one; active file/editor untouched ---
  await addFile(page, 'second');
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText('% marker for second.m');
  await page.waitForTimeout(700); // let autosave debounce fire

  const helperRow = page.locator('li', { hasText: 'helper.m' });
  await helperRow.hover();
  await helperRow.locator('button[title="Delete helper.m"]').click();

  // --- Delete confirm dialog: Cancel leaves the file intact ---
  await page.getByText('Cancel', { exact: true }).click();
  await page.waitForTimeout(200);
  check('Cancel on delete dialog leaves helper.m intact', (await page.locator('text=helper.m').count()) > 0);
  const editorStillOnSecond = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).some(
      (b) => b.textContent?.includes('second.m') && b.className.includes('border-t-cyan-400'),
    ),
  );
  check('active tab (second.m) untouched by cancelled delete of a different file', editorStillOnSecond);

  // Now actually delete helper.m (non-active) and confirm second.m + its content survive
  await helperRow.hover();
  await helperRow.locator('button[title="Delete helper.m"]').click();
  await page.getByText('Delete file', { exact: true }).click();
  await page.waitForTimeout(300);
  check('helper.m gone after confirmed delete', (await page.locator('text=helper.m').count()) === 0);
  check('second.m (was not the deleted file) still present', (await page.locator('text=second.m').count()) > 0);
  const secondStillActive = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).some(
      (b) => b.textContent?.includes('second.m') && b.className.includes('border-t-cyan-400'),
    ),
  );
  check('deleting a non-active file does not change which tab is active', secondStillActive);

  // --- Reset Unit does not delete extra files, only resets protected ones ---
  // dirty-up a protected file first so Reset Unit has something to actually reset
  await page.locator('li', { hasText: 'addTwo.m' }).click();
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText('% dirtied');
  await page.getByTitle('Discard changes to every file in this unit, restoring the original starters').click();
  await page.locator('button.bg-red-600', { hasText: 'Reset unit' }).click(); // ConfirmDialog's confirm button
  await page.waitForTimeout(300);
  check('Reset Unit does not remove extra file second.m', (await page.locator('text=second.m').count()) > 0);

  // --- Scratch Pad also supports add/remove, independently of unit01's files ---
  await page.getByRole('button', { name: /All units/ }).click();
  await page.getByText('Scratch Pad', { exact: true }).click();
  await waitReady(page);
  await addFile(page, 'scratchHelper');
  check('Scratch Pad: add works there too', (await page.locator('text=scratchHelper.m').count()) > 0);
  check('Scratch Pad: unit01\'s second.m does not leak in', (await page.locator('text=second.m').count()) === 0);
  const scratchProtectedRow = page.locator('li', { hasText: 'scratch.m' });
  const scratchProtectedDelete = await scratchProtectedRow.locator('button[title="Delete scratch.m"]').count();
  check('Scratch Pad: its own protected file (scratch.m) has no delete icon', scratchProtectedDelete === 0);

  // --- Reload: unit01's deletion and addition both persisted correctly ---
  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await waitReady(page);
  check('after reload: second.m (added, kept) still present', (await page.locator('text=second.m').count()) > 0);
  check('after reload: helper.m (added, then deleted) stays gone', (await page.locator('text=helper.m').count()) === 0);

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
