const { chromium } = require('playwright');

async function setFileContent(page, tabName, code) {
  await page.locator('button', { hasText: tabName }).last().click();
  await page.waitForTimeout(200);
  const editorArea = page.locator('.monaco-editor').first();
  await editorArea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
  await page.waitForTimeout(200);
}

async function runTestsAndGetOutput(page) {
  await page.getByText('Run Tests', { exact: true }).click();
  await page.waitForFunction(
    () => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'),
    { timeout: 15000 }
  );
  await page.waitForTimeout(300);
  return await page.locator('pre').textContent();
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5183/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), { timeout: 30000 });

  console.log('=== run 1: unsolved (fresh kernel) ===');
  const out1 = await runTestsAndGetOutput(page);
  console.log(out1.includes('Score: 0/30') ? 'PASS (0/30 as expected)' : 'UNEXPECTED:\n' + out1);

  console.log('=== solving circleArea.m, same session ===');
  await setFileContent(page, 'circleArea.m', "function a = circleArea(r)\n  a = pi * r^2;\nend\n");

  console.log('=== run 2: after fixing circleArea, SAME kernel session ===');
  const out2 = await runTestsAndGetOutput(page);
  const circleAreaPasses = out2.includes('[ PASS ] circleArea computes the area of a unit circle');
  console.log(circleAreaPasses ? 'PASS -- circleArea now shows PASS, no stale cache' : 'BUG STILL PRESENT:\n' + out2);

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
