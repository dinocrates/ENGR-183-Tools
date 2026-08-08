const { chromium } = require('playwright');
const fs = require('fs');
const JSZip = require('../node_modules/jszip');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground/';

  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });

  await page.click('.monaco-editor');
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText('function s = addTwo(a, b)\n  s = a + b;\nend');

  const [fileDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Download File', { exact: true }).click(),
  ]);
  const fileContent = fs.readFileSync(await fileDownload.path(), 'utf-8');
  console.log('prod: single file download reflects live edit:', fileContent.includes('s = a + b;'));

  const [zipDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByText('Download All (.zip)', { exact: true }).click(),
  ]);
  const zipBuf = fs.readFileSync(await zipDownload.path());
  const zip = await JSZip.loadAsync(zipBuf);
  const names = Object.keys(zip.files).sort();
  console.log('prod: zip contains all three files flat:', JSON.stringify(names) === JSON.stringify(['addTwo.m', 'circleArea.m', 'greet.m']));
  const zippedAddTwo = await zip.files['addTwo.m'].async('string');
  console.log('prod: zipped copy reflects live edit:', zippedAddTwo.includes('s = a + b;'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
