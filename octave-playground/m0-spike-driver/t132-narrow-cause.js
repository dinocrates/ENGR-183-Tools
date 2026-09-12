// Does the corruption require actually running code (Run File / syncOutputs),
// or does pure tab-switching (Starter.m -> report -> PublicCheck.m -> Starter.m)
// corrupt the model with zero code execution involved?
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
  const modelLen = async (uriTail) =>
    page.evaluate((tail) => {
      const m = window.monaco.editor.getModels().find((mm) => mm.uri.toString().endsWith(tail));
      return m ? m.getValue().length : -1;
    }, uriTail);

  await openTab('read_creep_data.m');
  await setEditorContent(SOLVED_READ_CREEP);
  await openTab('U05_GP05_FaultCreep_Starter.m');
  await setEditorContent(SOLVED_MAIN);
  console.log('Starter.m len right after typing:', await modelLen('Starter.m'));

  // Run File once so the report tab actually exists (unavoidable
  // precondition), but do NOT run anything else afterward.
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  console.log('Starter.m len after Run File:', await modelLen('Starter.m'));

  await openTab('GP05_fault_creep_summary.txt');
  console.log('Starter.m len after opening report tab:', await modelLen('Starter.m'));

  await openTab('U05_GP05_FaultCreep_PublicCheck.m');
  console.log('Starter.m len after opening PublicCheck tab (NOT run):', await modelLen('Starter.m'));

  await openTab('U05_GP05_FaultCreep_Starter.m');
  console.log('Starter.m len after switching straight back (no PublicCheck run):', await modelLen('Starter.m'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
