const { chromium } = require('playwright');

async function setFileContent(page, tabName, code) {
  await page.locator('button', { hasText: tabName }).last().click();
  await page.waitForTimeout(300);
  const editorArea = page.locator('.monaco-editor').first();
  await editorArea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const navigations = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) navigations.push(Date.now());
  });

  console.log('fresh profile, first visit...');
  await page.goto('https://dinocrates.github.io/ENGR-183-Tools/octave-playground/', {
    waitUntil: 'load',
    timeout: 60000,
  });

  // Let any self-triggered reload happen and fully settle before doing anything.
  await page.waitForTimeout(4000);
  console.log('navigations so far:', navigations.length);
  console.log('isolated after settle:', await page.evaluate(() => window.crossOriginIsolated));

  await page.waitForFunction(
    () => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'),
    { timeout: 60000 }
  );
  console.log('kernel status:', (await page.evaluate(() => document.body.innerText.slice(0, 60))).includes('Ready') ? 'READY' : 'NOT READY');

  await setFileContent(page, 'addTwo.m', "function s = addTwo(a, b)\n  s = a + b;\nend\n");
  await setFileContent(page, 'circleArea.m', "function a = circleArea(r)\n  a = pi * r^2;\nend\n");
  await setFileContent(page, 'greet.m', "function s = greet(name)\n  s = ['Hello, ' name '!'];\nend\n");

  await page.getByText('Run Tests', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'), { timeout: 20000 });
  await page.waitForTimeout(500);

  const output = await page.locator('pre').textContent();
  console.log('=== Run Tests output ===');
  console.log(output);
  await page.screenshot({ path: 't20-live-realistic.png' });

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
