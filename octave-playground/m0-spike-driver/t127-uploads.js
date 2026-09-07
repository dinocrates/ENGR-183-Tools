// Student file upload, end to end through the real UI.
//   - upload a CSV -> "My files" group, read-only, csvread() sees it
//   - upload a Download All .zip -> its .m files restore matching tabs
//   - oversize / binary rejected with a Command Window note
//   - remove an upload; survives a reload
//
//   node t127-uploads.js [baseUrl]
const { chromium } = require('playwright');
const JSZip = require('../node_modules/jszip');
const BASE = process.argv[2] || 'http://localhost:4173/';

let pass = 0, fail = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok && detail !== undefined) console.log('  ' + String(detail).replace(/\n/g, '\n  '));
  ok ? pass++ : fail++;
};

const CSV = '1,10\n2,25\n3,40\n4,55\n';   // col 2 sums to 130

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
  });
  await page.goto(BASE + '?unit=scratch', { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 220000 });
  await page.waitForTimeout(800);

  const body = () => page.evaluate(() => document.body.innerText);
  const editorText = () => page.evaluate(() => document.querySelector('.monaco-editor .view-lines')?.innerText ?? '');
  const setInputFiles = (payload) => page.setInputFiles('input[type=file]', payload);

  // --- 1. upload a CSV
  await setInputFiles({ name: 'my_data.csv', mimeType: 'text/csv', buffer: Buffer.from(CSV) });
  await page.waitForTimeout(1200);
  let t = await body();
  check('"My files" group appears', /My files/i.test(t));
  check('the uploaded CSV is listed', t.includes('my_data.csv'));
  check('Command Window notes the upload', t.includes('Uploaded my_data.csv'));

  await page.getByText('my_data.csv').first().click();
  await page.waitForTimeout(400);
  check('opening it shows the content read-only',
    (await editorText()).includes('55') &&
    (await page.evaluate(() => document.querySelector('.monaco-editor textarea')?.hasAttribute('readonly'))));

  // typing does nothing
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A'); await page.keyboard.press('Delete'); await page.keyboard.type('x');
  await page.waitForTimeout(200);
  check('the uploaded file cannot be edited', (await editorText()).includes('55'));

  // --- 2. csvread sees it from a Run File script
  await page.getByText('scratch.m', { exact: true }).first().click();
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A'); await page.keyboard.press('Delete');
  await page.keyboard.insertText('r = csvread("my_data.csv");\nfprintf("sum2=%d\\n", sum(r(:,2)));\n');
  await page.waitForTimeout(500);
  await page.getByText('Run File', { exact: true }).click();
  const readOk = await page.waitForFunction(() => document.body.innerText.includes('sum2=130'), null, { timeout: 30000 })
    .then(() => true).catch(() => false);
  check('csvread("my_data.csv") returns the uploaded rows', readOk, await body());

  // --- 3. it is not in Download All
  const [zip] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Download All (.zip)', { exact: true }).click(),
  ]);
  const fs = require('fs');
  const z = await JSZip.loadAsync(fs.readFileSync(await zip.path()));
  check('Download All excludes uploaded files', !Object.keys(z.files).includes('my_data.csv'), JSON.stringify(Object.keys(z.files)));

  // --- 4. reject a binary-ish / oversize upload
  const bogus = Buffer.alloc(600 * 1024, 7); // > 512 KB
  await setInputFiles({ name: 'huge.csv', mimeType: 'text/csv', buffer: bogus });
  await page.waitForTimeout(800);
  check('oversize upload is rejected with a note', (await body()).includes('Skipped huge.csv'), await body());

  // --- 5. upload a Download All zip -> restores scratch.m
  const restore = new JSZip();
  restore.file('scratch.m', 'disp("restored from zip")\n');
  const zipBuf = await restore.generateAsync({ type: 'nodebuffer' });
  await setInputFiles({ name: 'scratch.zip', mimeType: 'application/zip', buffer: zipBuf });
  await page.waitForTimeout(600);
  // confirm dialog: replace scratch.m
  const replaceBtn = page.getByRole('button', { name: /^Replace$/ });
  check('zip upload over an existing tab asks for confirmation', (await replaceBtn.count()) > 0);
  await replaceBtn.click();
  const restored = await page
    .locator('.monaco-editor .view-line', { hasText: 'restored from zip' })
    .first()
    .waitFor({ timeout: 10000 })
    .then(() => true)
    .catch(() => false);
  check('zip .m entry replaced the matching tab', restored, await editorText());

  // --- 6. survives a reload
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 220000 });
  await page.waitForTimeout(800);
  check('the uploaded CSV is still there after reload', (await body()).includes('my_data.csv'));

  // --- 7. remove it
  await page.getByText('my_data.csv').first().hover();
  await page.waitForTimeout(200);
  await page.locator('li', { hasText: 'my_data.csv' }).getByTitle(/Remove my_data.csv/).click();
  const rm = page.getByRole('button', { name: /^Remove$/ });
  if (await rm.count()) await rm.first().click();
  await page.waitForTimeout(500);
  check('removing the upload clears it', !(await body()).includes('my_data.csv'));

  check('no uncaught page errors', errs.length === 0, errs.join('\n'));

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e.message, e.stack);
  process.exit(1);
});
