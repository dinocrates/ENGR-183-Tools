const { chromium } = require('playwright');

async function setFileContent(page, tabName, code) {
  await page.locator('button', { hasText: tabName }).last().click();
  await page.waitForTimeout(300);
  const editorArea = page.locator('.monaco-editor').first();
  await editorArea.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
  await page.waitForTimeout(800); // let the debounced autosave fire
}

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto('http://localhost:5183/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), { timeout: 30000 });

  await setFileContent(page, 'addTwo.m', "function s = addTwo(a, b)\n  s = a + b + 999;\nend\n");
  await page.waitForTimeout(1000); // extra margin past the 500ms debounce

  console.log('reloading page...');
  await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), { timeout: 30000 });
  await page.waitForTimeout(500);

  const editorText = await page.locator('.monaco-editor').first().textContent();
  console.log('EDITOR AFTER RELOAD:', editorText);
  console.log('persisted correctly:', editorText.includes('999'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
