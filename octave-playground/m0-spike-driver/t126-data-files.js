// DESIGN.md T3.30 -- bundled read-only data files per unit, end to end
// through the real UI. Uses the Scratch Pad's demo dataFile
// (sample_readings.csv): it shows in a read-only Data group, opens
// read-only, csvread(engr183.data(...)) reads the bundled rows from a Run
// File script, editing is refused, and Download All contains the file.
//
//   node t126-data-files.js [baseUrl]
const { chromium } = require('playwright');
const fs = require('fs');
const JSZip = require('../node_modules/jszip');

const BASE = process.argv[2] || 'http://localhost:4173/';

let pass = 0, fail = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok && detail !== undefined) console.log('  ' + String(detail).replace(/\n/g, '\n  '));
  ok ? pass++ : fail++;
};

// col 2 of sample_readings.csv sums to exactly 370
const EXPECTED_SUM = 370;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
  });
  await page.goto(BASE + '?unit=scratch', { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 200000 });
  await page.waitForTimeout(800);

  const editorText = () =>
    page.evaluate(() => document.querySelector('.monaco-editor .view-lines')?.innerText ?? '');
  const bodyText = () => page.evaluate(() => document.body.innerText);

  // --- 1. the File Browser lists the data file under a Data group
  check(
    'File Browser shows a "Data" group',
    (await page.getByText('Data', { exact: true }).count()) > 0,
  );
  check(
    'the bundled data file is listed',
    (await page.getByText('sample_readings.csv').count()) > 0,
  );

  // --- 2. the ProblemStatement shows the how-to-open snippet
  check(
    "ProblemStatement shows engr183.data('sample_readings.csv')",
    (await bodyText()).includes("engr183.data('sample_readings.csv')"),
  );

  // --- 3. opening it shows read-only content, no breakpoint gutter
  await page.getByText('sample_readings.csv').first().click();
  await page.waitForTimeout(500);
  const opened = await editorText();
  check('opening the data file shows its rows', opened.includes('24.9') && opened.includes('42'), opened);

  const readonlyAttr = await page.evaluate(
    () => document.querySelector('.monaco-editor textarea')?.hasAttribute('readonly') ?? false,
  );
  check('the data-file editor is read-only (textarea[readonly])', readonlyAttr);

  // clicking the left gutter must not set a breakpoint on a data file
  const box = await page.locator('.monaco-editor').first().boundingBox();
  await page.mouse.click(box.x + 5, box.y + 40);
  await page.waitForTimeout(300);
  const bpGlyphs = await page.locator('.engr183-bp-glyph').count();
  check('clicking the gutter sets no breakpoint on a data file', bpGlyphs === 0, `bp glyphs: ${bpGlyphs}`);

  // --- 4. editing is refused
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.type('tampered');
  await page.waitForTimeout(300);
  check('typing into the data file does nothing', (await editorText()).includes('24.9'), await editorText());

  // --- 5. csvread(engr183.data(...)) reads the bundled rows from Run File
  await page.getByText('scratch.m', { exact: true }).first().click();
  await page.waitForTimeout(300);
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(
    'r = csvread(engr183.data("sample_readings.csv"));\n' +
      'fprintf("rows=%d cols=%d sum2=%g\\n", rows(r), columns(r), sum(r(:, 2)));\n',
  );
  await page.waitForTimeout(700);
  await page.getByText('Run File', { exact: true }).click();
  const ran = await page
    .waitForFunction(
      (s) => document.body.innerText.includes(`rows=11 cols=2 sum2=${s}`),
      EXPECTED_SUM,
      { timeout: 30000 },
    )
    .then(() => true)
    .catch(() => false);
  check('csvread(engr183.data(...)) returns the bundled 11x2 data', ran, await bodyText());

  // --- 6. Download All contains the data file
  const [zipDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Download All (.zip)', { exact: true }).click(),
  ]);
  const zip = await JSZip.loadAsync(fs.readFileSync(await zipDownload.path()));
  const names = Object.keys(zip.files).sort();
  check('Download All (.zip) includes the data file', names.includes('sample_readings.csv'), JSON.stringify(names));
  const zipped = names.includes('sample_readings.csv')
    ? await zip.files['sample_readings.csv'].async('string')
    : '';
  check('the zipped data file is the bundled content, not tampered', zipped.includes('24.9') && !zipped.includes('tampered'));

  check('no uncaught page errors', pageErrors.length === 0, pageErrors.join('\n'));

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e.message, e.stack);
  process.exit(1);
});
