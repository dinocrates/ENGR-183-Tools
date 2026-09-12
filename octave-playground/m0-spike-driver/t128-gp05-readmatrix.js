// GP-05 dlmread -> readmatrix migration, end to end through the real UI.
//
//   node t128-gp05-readmatrix.js [baseUrl]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const JSZip = require('../node_modules/jszip');

const BASE = process.argv[2] || 'http://localhost:5183/';
const HARNESS = path.join(__dirname, '..', '..', 'engr183-harness');

const SOLVED_READ_CREEP = fs.readFileSync(
  path.join(HARNESS, '_verify', 'solved', 'u05-gp05-fault-creep', 'read_creep_data.m'),
  'utf8',
);
const SOLVED_MAIN = fs.readFileSync(
  path.join(HARNESS, '_verify', 'solved', 'u05-gp05-fault-creep', 'U05_GP05_FaultCreep_Starter.m'),
  'utf8',
);

let pass = 0, fail = 0;
const check = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok && detail !== undefined) console.log('  ' + String(detail).replace(/\n/g, '\n  '));
  ok ? pass++ : fail++;
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
  });

  const bodyText = () => page.evaluate(() => document.body.innerText);
  // The DOM-rendered `.view-lines` text is virtualized (only currently
  // scrolled-into-view lines are present) and uses U+00A0 for spaces, not
  // plain ASCII (see t61's notes) -- read the live Monaco model's actual
  // value instead of scraping the DOM for anything content-sensitive.
  const modelValue = (fileName) =>
    page.evaluate(
      (name) => window.monaco?.editor.getModels().find((m) => m.uri.path.replace(/^\//, '') === name)?.getValue() ?? '',
      fileName,
    );
  // Output files render as buttons with this exact title (FileBrowser.tsx) --
  // scope the "no lingering fixtures" check to just those, not the whole
  // page (which also shows the fixture names as literal text inside
  // PublicCheck.m's own source in the editor pane).
  const outputFileNames = () =>
    page.evaluate(() =>
      Array.from(document.querySelectorAll('button[title="Written by your own code — read-only"]')).map(
        (b) => b.textContent?.trim(),
      ),
    );
  const openTab = async (name) => {
    await page.getByText(name, { exact: true }).first().click();
    await page.waitForTimeout(300);
  };
  const setEditorContent = async (text) => {
    await page.click('.monaco-editor');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.insertText(text);
    await page.waitForTimeout(300);
  };
  const waitReady = () =>
    page.waitForFunction(
      () => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'),
      null,
      { timeout: 30000 },
    );

  await page.goto(BASE + '?unit=u05-gp05-fault-creep', { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 200000 });
  await page.waitForTimeout(800);

  // --- 1. Route loads: starters + data file present
  check('main file listed', (await page.getByText('U05_GP05_FaultCreep_Starter.m').count()) > 0);
  check('function file listed', (await page.getByText('read_creep_data.m').count()) > 0);
  check('public check listed', (await page.getByText('U05_GP05_FaultCreep_PublicCheck.m').count()) > 0);
  check('bundled data file listed', (await page.getByText('parkfield_xpk2_daily_excerpt.txt').count()) > 0);

  // --- 2. Paste the readmatrix-based solved implementation + main script
  await openTab('read_creep_data.m');
  await setEditorContent(SOLVED_READ_CREEP);
  const fnModel = await modelValue('read_creep_data.m');
  check('editor shows readmatrix, not dlmread', fnModel.includes('readmatrix') && !fnModel.includes('dlmread'), fnModel);

  await openTab('U05_GP05_FaultCreep_Starter.m');
  await setEditorContent(SOLVED_MAIN);

  // --- 3. Run File on the completed main script
  await page.getByText('Run File', { exact: true }).click();
  await waitReady();
  await page.waitForTimeout(500);
  const runOutput = await bodyText();
  check('main script prints records/slip summary', runOutput.includes('Records: 40') && /[Ss]lip/.test(runOutput), runOutput);

  // --- 4. Generated report appears immediately, no reload
  check(
    'GP05_fault_creep_summary.txt appears in the file panel without a refresh',
    (await page.getByText('GP05_fault_creep_summary.txt').count()) > 0,
  );
  check('Output files group shown', (await page.getByText('Output files', { exact: true }).count()) > 0);

  // --- 5. Open it, check content
  await openTab('GP05_fault_creep_summary.txt');
  const reportShown = await modelValue('GP05_fault_creep_summary.txt');
  check(
    'report content includes source/records/interpretation boundary',
    reportShown.includes('Parkfield') && reportShown.includes('Records: 40') && /forecast/i.test(reportShown),
    reportShown,
  );

  // --- 6. Download it individually, byte-compare with what's shown
  const [fileDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Download File', { exact: true }).click(),
  ]);
  const downloadedReport = fs.readFileSync(await fileDownload.path(), 'utf8');
  check(
    'downloaded report matches the runtime content',
    downloadedReport.replace(/\r\n/g, '\n').trim() === reportShown.replace(/\r\n/g, '\n').trim(),
    `downloaded:\n${downloadedReport}\n---shown:\n${reportShown}`,
  );

  // --- 7. Download All (.zip) includes it
  const [zipDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Download All (.zip)', { exact: true }).click(),
  ]);
  const zip = await JSZip.loadAsync(fs.readFileSync(await zipDownload.path()));
  const names = Object.keys(zip.files).sort();
  check('Download All (.zip) includes the generated report', names.includes('GP05_fault_creep_summary.txt'), JSON.stringify(names));
  check('Download All (.zip) excludes the public check', !names.includes('U05_GP05_FaultCreep_PublicCheck.m'), JSON.stringify(names));
  const zippedReport = names.includes('GP05_fault_creep_summary.txt')
    ? await zip.files['GP05_fault_creep_summary.txt'].async('string')
    : '';
  check(
    'zipped report matches the runtime content',
    zippedReport.replace(/\r\n/g, '\n').trim() === reportShown.replace(/\r\n/g, '\n').trim(),
  );

  // --- 8. Public check runs clean and leaves no fixture files behind
  await openTab('U05_GP05_FaultCreep_PublicCheck.m');
  await page.getByText('Run File', { exact: true }).click();
  await waitReady();
  await page.waitForTimeout(500);
  const checkOutput = await bodyText();
  check('public check passes', checkOutput.includes('GP-05 public checks passed.'), checkOutput);
  const lingering = await outputFileNames();
  check(
    'public check fixtures do not linger in the file panel',
    !lingering.includes('gp05_optional_column_test.txt') && !lingering.includes('gp05_bad_day_test.txt'),
    JSON.stringify(lingering),
  );

  // --- 9. Run Tests: full score
  await page.getByText('Run Tests', { exact: true }).click();
  await waitReady();
  await page.waitForTimeout(500);
  const testsOutput = await bodyText();
  check('Run Tests reports 10/10', /Score: 10\/10/.test(testsOutput), testsOutput);
  check('Run Tests reports all 7 criteria met', /Criteria met: 7 of 7/.test(testsOutput), testsOutput);

  // --- 10. Reset unit: report disappears, starters restored
  await page.getByRole('button', { name: 'Reset unit', exact: true, disabled: false }).first().click();
  await page.waitForTimeout(300);
  await page.locator('button.bg-danger', { hasText: 'Reset unit' }).click();
  await page.waitForTimeout(800);
  check(
    'generated report is gone after Reset unit',
    (await page.getByText('GP05_fault_creep_summary.txt').count()) === 0,
  );
  await openTab('read_creep_data.m');
  const resetFn = await modelValue('read_creep_data.m');
  check('read_creep_data.m restored to the published starter (TODO 1)', resetFn.includes('TODO 1'), resetFn);
  check('bundled data file still present after reset', (await page.getByText('parkfield_xpk2_daily_excerpt.txt').count()) > 0);

  check('no uncaught page errors', pageErrors.length === 0, pageErrors.join('\n'));

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})().catch((e) => {
  console.error('FATAL', e.message, e.stack);
  process.exit(1);
});
