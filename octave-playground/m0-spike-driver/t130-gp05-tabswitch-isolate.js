// Isolate: does simply opening the generated output file's tab and then
// switching back to the main script corrupt the main script's editor
// content (independent of Run Tests / downloads)?
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.argv[2] || 'http://localhost:5183/';
const HARNESS = path.join(__dirname, '..', '..', 'engr183-harness');
const SOLVED_READ_CREEP = fs.readFileSync(
  path.join(HARNESS, '_verify', 'solved', 'u05-gp05-fault-creep', 'read_creep_data.m'), 'utf8');
const SOLVED_MAIN = fs.readFileSync(
  path.join(HARNESS, '_verify', 'solved', 'u05-gp05-fault-creep', 'U05_GP05_FaultCreep_Starter.m'), 'utf8');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
  });
  await page.goto(BASE + '?unit=u05-gp05-fault-creep', { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 200000 });
  await page.waitForTimeout(800);

  const editorText = () =>
    page.evaluate(() => document.querySelector('.monaco-editor .view-lines')?.innerText ?? '');
  const openTab = async (name) => {
    await page.getByText(name, { exact: true }).first().click();
    await page.waitForTimeout(400);
  };
  const setEditorContent = async (text) => {
    await page.click('.monaco-editor');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.insertText(text);
    await page.waitForTimeout(300);
  };

  await openTab('read_creep_data.m');
  await setEditorContent(SOLVED_READ_CREEP);

  await openTab('U05_GP05_FaultCreep_Starter.m');
  await setEditorContent(SOLVED_MAIN);
  const beforeSwitch = await editorText();
  console.log('Starter.m has "readmatrix"?', beforeSwitch.includes('readmatrix')); // shouldn't, main script doesn't call readmatrix directly. just a length check
  console.log('Starter.m length before switch:', beforeSwitch.length);

  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'), null, { timeout: 30000 });
  await page.waitForTimeout(500);

  // Open the freshly generated output file, then switch straight back.
  await openTab('GP05_fault_creep_summary.txt');
  const reportText = await editorText();
  console.log('Report tab content (first 80 chars):', JSON.stringify(reportText.slice(0, 80)));

  await openTab('U05_GP05_FaultCreep_Starter.m');
  const afterSwitch = await editorText();
  console.log('Starter.m length after switching to report and back:', afterSwitch.length);
  console.log(
    afterSwitch.trim() === beforeSwitch.trim()
      ? 'PASS: Starter.m content unchanged after visiting the report tab'
      : 'FAIL: Starter.m content CHANGED after visiting the report tab',
  );
  if (afterSwitch.trim() !== beforeSwitch.trim()) {
    console.log('--- afterSwitch ---');
    console.log(afterSwitch);
  }

  // Keep going: download it, download the zip, visit the public check,
  // run it, then check Starter.m again.
  const [fileDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Download File', { exact: true }).click(),
  ]);
  await fileDownload.path();
  console.log('after Download File, active tab content length:', (await editorText()).length);

  const [zipDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Download All (.zip)', { exact: true }).click(),
  ]);
  await zipDownload.path();

  await openTab('U05_GP05_FaultCreep_Starter.m');
  const afterDownloads = await editorText();
  console.log(
    afterDownloads.trim() === beforeSwitch.trim()
      ? 'PASS: Starter.m unchanged after Download File + Download All'
      : 'FAIL: Starter.m CHANGED after Download File + Download All',
  );

  await openTab('U05_GP05_FaultCreep_PublicCheck.m');
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'), null, { timeout: 30000 });
  await page.waitForTimeout(500);

  await openTab('U05_GP05_FaultCreep_Starter.m');
  const afterPublicCheck = await editorText();
  console.log(
    afterPublicCheck.trim() === beforeSwitch.trim()
      ? 'PASS: Starter.m unchanged after running the public check'
      : 'FAIL: Starter.m CHANGED after running the public check',
  );
  if (afterPublicCheck.trim() !== beforeSwitch.trim()) {
    console.log('--- afterPublicCheck (raw):', JSON.stringify(afterPublicCheck));
    console.log('--- body text snapshot ---');
    console.log((await page.evaluate(() => document.body.innerText)).slice(0, 2000));
    await page.screenshot({ path: 't130-failure.png', fullPage: true });
    console.log('screenshot saved to t130-failure.png');
    // Which tab button is actually marked active right now?
    const activeTabs = await page.evaluate(() =>
      Array.from(document.querySelectorAll('button')).filter((b) => /bg-app/.test(b.className)).map((b) => b.textContent),
    );
    console.log('buttons with active-tab styling:', activeTabs);
  }

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
