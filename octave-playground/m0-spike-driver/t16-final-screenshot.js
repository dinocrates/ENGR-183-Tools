const { chromium } = require('playwright');

async function setFileContent(page, tabName, code) {
  await page.locator('button', { hasText: tabName }).last().click();
  await page.waitForTimeout(300);
  const editorArea = page.locator('.monaco-editor').first();
  await editorArea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
  await page.waitForTimeout(200);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto('http://localhost:5183/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), { timeout: 30000 });

  await setFileContent(page, 'addTwo.m', "function s = addTwo(a, b)\n  s = a + b;\nend\n");
  await setFileContent(page, 'circleArea.m', "function a = circleArea(r)\n  a = pi * r^2;\nend\n");
  await setFileContent(page, 'greet.m', "function s = greet(name)\n  s = ['Hello, ' name '!'];\nend\n");
  await page.locator('button', { hasText: 'addTwo.m' }).last().click();

  await page.getByText('Run Tests', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'), { timeout: 15000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'm1-mvp-final.png' });

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
