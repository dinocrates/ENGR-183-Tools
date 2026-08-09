const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'http://localhost:4173/';

  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));
  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });

  // --- Add a file ---
  await page.getByTitle('Add a new file').click();
  await page.locator('input[placeholder="newFile.m"]').fill('helper');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);

  const fileBrowserHasHelper = await page.locator('text=helper.m').count();
  console.log('helper.m added to File Browser:', fileBrowserHasHelper > 0);

  const editorTabHasHelper = await page.locator('.monaco-editor').count(); // sanity: editor still mounted
  console.log('editor still mounted after add:', editorTabHasHelper > 0);

  const activeTabIsHelper = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button')).some(
      (b) => b.textContent?.includes('helper.m') && b.className.includes('border-t-cyan-400'),
    ),
  );
  console.log('helper.m became the active editor tab:', activeTabIsHelper);

  // --- Duplicate name rejected ---
  await page.getByTitle('Add a new file').click();
  await page.locator('input[placeholder="newFile.m"]').fill('helper');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const dupError = await page.locator('text=already exists').count();
  console.log('duplicate name rejected with inline error:', dupError > 0);
  await page.keyboard.press('Escape');

  // --- Invalid name rejected ---
  await page.getByTitle('Add a new file').click();
  await page.locator('input[placeholder="newFile.m"]').fill('../evil');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  const invalidError = await page.locator('text=letters/numbers/underscores').count();
  console.log('invalid name rejected with inline error:', invalidError > 0);
  await page.keyboard.press('Escape');

  // --- Write code into helper.m and run it via Run File ---
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("disp('hello from helper')");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('hello from helper'), null, { timeout: 30000 });
  console.log('helper.m content reached the kernel and ran: true');

  // --- Protected file has no delete icon; extra file does ---
  const addTwoRow = page.locator('li', { hasText: 'addTwo.m' });
  const addTwoDeleteCount = await addTwoRow.locator('button[title="Delete addTwo.m"]').count();
  console.log('protected file (addTwo.m) has no delete icon:', addTwoDeleteCount === 0);

  const helperRow = page.locator('li', { hasText: 'helper.m' });
  await helperRow.hover();
  const helperDeleteCount = await helperRow.locator('button[title="Delete helper.m"]').count();
  console.log('extra file (helper.m) has a delete icon:', helperDeleteCount > 0);

  // --- Reset File disabled while an extra file is active ---
  const resetDisabled = await page.getByText('Reset File', { exact: true }).isDisabled();
  console.log('Reset File disabled while extra file active:', resetDisabled);

  // --- Delete the extra file, confirm dialog, confirm removal ---
  await helperRow.locator('button[title="Delete helper.m"]').click();
  await page.getByText('Delete file', { exact: true }).click();
  await page.waitForTimeout(300);
  const helperGoneFromBrowser = (await page.locator('text=helper.m').count()) === 0;
  console.log('helper.m removed from File Browser after delete:', helperGoneFromBrowser);

  const activeFileAfterDelete = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.monaco-editor')).length > 0,
  );
  console.log('editor still functional after deleting active file:', activeFileAfterDelete);

  // --- Add another extra file, reload, confirm it persists ---
  await page.getByTitle('Add a new file').click();
  await page.locator('input[placeholder="newFile.m"]').fill('scratch2');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(500); // let the 500ms autosave debounce flush

  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });
  const scratch2Persisted = await page.locator('text=scratch2.m').count();
  console.log('added file persists across reload (directory rediscovery):', scratch2Persisted > 0);

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
