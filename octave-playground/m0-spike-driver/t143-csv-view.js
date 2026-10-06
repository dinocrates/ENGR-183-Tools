// Build and serve the app, then: node t143-csv-view.js http://127.0.0.1:4186/
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.argv[2] || 'http://127.0.0.1:4186/';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  let monacoCancellations = 0;
  page.on('pageerror', error => {
    // Monaco's existing model-switch cancellation also occurs in Raw-only
    // upload/tab switching (the Unit 6–8 regressions allow it as well).
    if (error.message === 'Canceled' && /monaco-editor/.test(error.stack) && /at setModel/.test(error.stack)) {
      monacoCancellations++;
      return;
    }
    errors.push(error.stack || error.message);
    console.error('BROWSER ERROR:', error.stack || error.message);
  });
  page.setDefaultTimeout(15000);
  const check = (message, condition) => {
    assert.ok(condition, message);
    console.log('PASS:', message);
  };
  const openFile = name => page.getByText(name, { exact: true }).first().click();
  const raw = () => page.getByRole('button', { name: 'Raw', exact: true });
  const table = () => page.getByRole('button', { name: 'Table', exact: true });
  const headers = () => page.getByRole('checkbox', { name: 'First row is headers' });
  const editor = page.locator('.monaco-editor');
  const editorText = () => page.locator('.monaco-editor .view-lines').innerText();
  const ready = () => page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 200000 });
  async function upload(name, content) {
    await page.setInputFiles('input[type=file]', { name, mimeType: 'text/plain', buffer: Buffer.from(content) });
    await openFile(name.replace(/\.[^.]+$/, extension => extension.toLowerCase()));
  }

  try {
    await page.addInitScript(() => {
      localStorage.setItem('engr183-persistence-ack', '1');
      localStorage.setItem('engr183-onboarding-seen', '1');
    });
    await page.goto(BASE + '?unit=scratch', { waitUntil: 'load', timeout: 90000 });
    await ready();
    await editor.waitFor({ state: 'visible' });
    check('code files do not show the CSV toggle', await table().count() === 0);
    await editor.click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText('csv_view_value = 1;\n');
    await page.keyboard.press('Control+End');
    await page.keyboard.insertText('\n% csv-view-undo-marker');
    await editor.locator('.view-line').filter({ hasText: 'csv-view-undo-marker' }).waitFor();
    check('the test edit is present', (await editorText()).includes('csv-view-undo-marker'));
    await editor.locator('.line-numbers').filter({ hasText: /^1$/ }).click();
    await editor.locator('.engr183-bp-glyph').first().waitFor();

    await openFile('sample_readings.csv');
    check('CSV opens in Raw by default', await raw().getAttribute('aria-pressed') === 'true');
    check('raw CSV is read-only', await editor.locator('textarea').getAttribute('readonly') !== null);
    await table().click();
    const sample = page.getByRole('table', { name: 'sample_readings.csv', exact: true });
    await sample.waitFor();
    check('headerless sample preserves all 11 rows', await sample.locator('tbody tr').count() === 11);
    check('headerless columns are numbered', (await sample.locator('thead').innerText()).includes('Column 1'));
    check('first numeric row is retained', await sample.locator('tbody tr').first().locator('td').first().innerText() === '0');
    check('table is read-only', await sample.locator('input,textarea,[contenteditable=true]').count() === 0);
    check('Monaco stays mounted while hidden', await editor.count() === 1 && !await editor.isVisible());
    await raw().click();
    await editor.waitFor({ state: 'visible' });
    await editor.locator('.view-line').filter({ hasText: '24.9' }).waitFor();
    check('raw CSV still contains the source data', (await editorText()).includes('24.9'));
    await table().click();
    await openFile('scratch.m');
    await editor.waitFor({ state: 'visible' });
    await editor.locator('.view-line').filter({ hasText: 'csv-view-undo-marker' }).waitFor();
    check('switching views and files preserves code edits', (await editorText()).includes('csv-view-undo-marker'));
    check('switching back restores breakpoints', await editor.locator('.engr183-bp-glyph').count() > 0);
    await editor.click();
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => !document.querySelector('.monaco-editor .view-lines')?.textContent.includes('csv-view-undo-marker'));
    check('code undo history survives table view', !(await editorText()).includes('csv-view-undo-marker'));

    const quoted = 'Name,Note,Value\r\n"A, B","said ""hello""\nnext line",001.20\r\n';
    await upload('quoted.CSV', quoted);
    const quotedTable = page.getByRole('table', { name: 'quoted.csv', exact: true });
    await quotedTable.waitFor();
    check('uploaded CSV respects the saved table choice', await table().getAttribute('aria-pressed') === 'true');
    check('text headings are inferred', await headers().isChecked());
    assert.deepEqual(await quotedTable.locator('tbody td').allTextContents(), ['A, B', 'said "hello"\nnext line', '001.20']);
    console.log('PASS: quoted fields and numeric formatting render faithfully');
    await headers().uncheck();
    check('header override restores the first row as data', await quotedTable.locator('tbody tr').count() === 2);
    await raw().click();
    await table().click();
    check('header override survives Raw/Table changes', !await headers().isChecked());
    await openFile('sample_readings.csv');
    await openFile('quoted.csv');
    check('header override survives file switching', !await headers().isChecked());
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download File', exact: true }).click(),
    ]);
    check('view changes do not alter downloaded CSV bytes', fs.readFileSync(await download.path(), 'utf8') === quoted);

    await upload('empty.csv', '');
    await page.getByText('This CSV file is empty.', { exact: true }).waitFor();
    console.log('PASS: empty CSV has a clear empty state');
    await upload('broken.csv', 'Name,Value\n"unclosed,1');
    await page.getByText(/Table view is unavailable/).waitFor();
    await raw().click();
    await editor.waitFor({ state: 'visible' });
    await editor.locator('.view-line').filter({ hasText: 'unclosed' }).waitFor();
    check('malformed CSV remains accessible in Raw', (await editorText()).includes('unclosed'));
    await upload('notes.txt', 'plain text');
    check('non-CSV data remains a text view', await table().count() === 0 && await editor.isVisible());

    await upload('large.csv', 'Label,Value\n' + Array.from({ length: 405 }, (_, i) => `row ${i + 1},${i + 1}`).join('\n'));
    await table().click();
    const large = page.getByRole('table', { name: 'large.csv', exact: true });
    await large.waitFor();
    check('large CSV starts with a bounded 200-row page', await large.locator('tbody tr').count() === 200);
    await page.getByRole('button', { name: 'Next rows' }).click();
    check('pagination preserves row numbers and values', await large.locator('tbody th').first().innerText() === '201' && await large.locator('tbody td').first().innerText() === 'row 201');
    await page.getByRole('button', { name: 'Next rows' }).click();
    check('final page retains all remaining rows', await large.locator('tbody tr').count() === 5 && await page.getByRole('button', { name: 'Next rows' }).isDisabled());
    await page.getByRole('button', { name: 'Previous rows' }).click();
    const region = page.getByRole('region', { name: 'large.csv table', exact: true });
    await region.evaluate(element => { element.scrollTop = 250; });
    const sticky = await large.locator('thead th').nth(1).boundingBox();
    const bounds = await region.boundingBox();
    check('column headings stay visible while scrolling', Math.abs(sticky.y - bounds.y) < 2);
    await region.focus();
    check('the scrolling region is keyboard-focusable', await region.evaluate(element => document.activeElement === element));

    for (const theme of ['dark', 'light', 'high-contrast', 'retro', 'matrix']) {
      await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption(theme);
      const colors = await large.locator('thead th').nth(1).evaluate(element => {
        const style = getComputedStyle(element);
        return [style.color, style.backgroundColor];
      });
      check(`${theme} theme gives headings distinct text and background colors`, colors[0] !== colors[1]);
    }
    await page.getByRole('combobox', { name: 'Theme', exact: true }).selectOption('dark');
    const initialFontSize = await region.evaluate(element => getComputedStyle(element).fontSize);
    await page.getByTitle('Increase text size', { exact: true }).first().click();
    check('editor text-size controls also resize the table', initialFontSize !== await region.evaluate(element => getComputedStyle(element).fontSize));

    await page.reload({ waitUntil: 'load' });
    await ready();
    await openFile('sample_readings.csv');
    await sample.waitFor();
    check('table preference survives a page reload', await table().getAttribute('aria-pressed') === 'true');

    await page.goto(BASE + '?unit=u08-project-solar-station', { waitUntil: 'load', timeout: 90000 });
    await ready();
    await openFile('BOM.csv');
    const bom = page.getByRole('table', { name: 'BOM.csv', exact: true });
    await bom.waitFor();
    check('BOM uses its headers and all five component rows', await headers().isChecked() && await bom.locator('tbody tr').count() === 5 && (await bom.locator('thead').innerText()).includes('Component'));
    await page.screenshot({ path: path.join(__dirname, 'csv-table-bom.png') });
    await openFile('solar_station_measurements.csv');
    const solar = page.getByRole('table', { name: 'solar_station_measurements.csv', exact: true });
    await solar.waitFor();
    check('solar measurements retain the numeric first row and eleven columns', !await headers().isChecked() && await solar.locator('tbody tr').first().locator('td').count() === 11 && await solar.locator('tbody td').first().innerText() === '1');
    await page.screenshot({ path: path.join(__dirname, 'csv-table-solar.png') });
    await page.setViewportSize({ width: 900, height: 800 });
    check('Raw/Table controls remain visible at a narrower width', await raw().isVisible() && await table().isVisible());
    check('wide data scrolls inside its table', await page.getByRole('region', { name: 'solar_station_measurements.csv table' }).evaluate(element => element.scrollWidth > element.clientWidth));
    assert.deepEqual(errors, [], 'no unexpected browser errors');
    console.log(`PASS: no unexpected browser errors (${monacoCancellations} existing Monaco model-switch cancellations)`);
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
