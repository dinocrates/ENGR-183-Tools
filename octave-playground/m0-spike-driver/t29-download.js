const { chromium } = require('playwright');
const fs = require('fs');
const JSZip = require('../node_modules/jszip');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1')); // T3.4: skip the first-visit warning, not what this script tests

  await page.goto('http://localhost:5183/?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  // Edit the active file so we can confirm downloads reflect the live buffer,
  // not the original starter -- T3.2's acceptance criterion is "the exact
  // bytes the kernel ran," not "the original starter content."
  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText('function s = addTwo(a, b)\n  s = a + b;\nend');

  const [fileDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Download File', { exact: true }).click(),
  ]);
  console.log('single file suggested filename:', fileDownload.suggestedFilename());
  const fileContent = fs.readFileSync(await fileDownload.path(), 'utf-8');
  console.log('single file reflects live edit:', fileContent.includes('s = a + b;'));

  const [zipDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Download All (.zip)', { exact: true }).click(),
  ]);
  console.log('zip suggested filename:', zipDownload.suggestedFilename());
  const zipBuf = fs.readFileSync(await zipDownload.path());
  const zip = await JSZip.loadAsync(zipBuf);
  const names = Object.keys(zip.files).sort();
  console.log('zip contains all three unit files, flat (no folders):', JSON.stringify(names) === JSON.stringify(['addTwo.m', 'circleArea.m', 'greet.m']));
  const zippedAddTwo = await zip.files['addTwo.m'].async('string');
  console.log('zipped addTwo.m reflects live edit too:', zippedAddTwo.includes('s = a + b;'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
