// Minimal repro: does Run Tests still pass 10/10 if we NEVER open the
// generated output file's tab (no report-viewing, no downloads)?
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

  const setEditorContent = async (text) => {
    await page.click('.monaco-editor');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await page.keyboard.insertText(text);
    await page.waitForTimeout(300);
  };

  await page.getByText('read_creep_data.m', { exact: true }).first().click();
  await page.waitForTimeout(300);
  await setEditorContent(SOLVED_READ_CREEP);

  await page.getByText('U05_GP05_FaultCreep_Starter.m', { exact: true }).first().click();
  await page.waitForTimeout(300);
  await setEditorContent(SOLVED_MAIN);

  await page.getByText('Run Tests', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'), null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const out = await page.evaluate(() => document.body.innerText);
  console.log(/Score: \d+\/10/.exec(out)?.[0] ?? 'NO SCORE FOUND');
  console.log(out.includes('Score: 10/10') ? 'PASS: 10/10 with no tab-switch/report-view' : 'FAIL: not 10/10');
  if (!out.includes('Score: 10/10')) console.log(out);

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
