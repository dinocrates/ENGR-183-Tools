const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
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
  await page.goto('http://localhost:5183/?unit=u05-gp05-fault-creep', { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 200000 });
  await page.waitForTimeout(800);

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
  const dumpModels = async (label) => {
    const hasMonaco = await page.evaluate(() => typeof window.monaco !== 'undefined');
    if (!hasMonaco) { console.log(label, '-- window.monaco not defined'); return; }
    const models = await page.evaluate(() =>
      window.monaco.editor.getModels().map((m) => ({ uri: m.uri.toString(), len: m.getValue().length, head: m.getValue().slice(0, 60) })),
    );
    console.log(label, JSON.stringify(models, null, 2));
  };

  await openTab('read_creep_data.m');
  await setEditorContent(SOLVED_READ_CREEP);
  await openTab('U05_GP05_FaultCreep_Starter.m');
  await setEditorContent(SOLVED_MAIN);
  await dumpModels('AFTER EDITS');

  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  await dumpModels('AFTER RUN FILE (main script)');

  await openTab('GP05_fault_creep_summary.txt');
  await dumpModels('AFTER OPENING REPORT TAB');

  await openTab('U05_GP05_FaultCreep_PublicCheck.m');
  await dumpModels('AFTER OPENING PUBLICCHECK TAB (before running it)');
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  await dumpModels('AFTER RUNNING PUBLICCHECK');

  await openTab('U05_GP05_FaultCreep_Starter.m');
  await dumpModels('AFTER SWITCHING BACK TO Starter.m');

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
