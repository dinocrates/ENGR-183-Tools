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

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));

  await page.goto('http://localhost:5183/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), { timeout: 30000 });

  // Put plot code into addTwo.m and use "Run File" to execute it directly
  await setFileContent(page, 'addTwo.m', "function s = addTwo(a, b)\n  s = a + b;\nend\nplot([1 2 3],[4 5 6]); xlabel('x'); title('test plot');\ndisp('done plotting')\n");
  await page.getByText('Run File', { exact: true }).click();
  await page.waitForFunction(() => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'), { timeout: 15000 });
  await page.waitForTimeout(1000);

  const output = await page.locator('pre').textContent();
  console.log('=== Command Window output ===');
  console.log(output);

  console.log('=== message types seen ===');
  console.log(logs.filter(l => l.includes('DEBUG msg_type')).join('\n').slice(0, 3000));

  await page.screenshot({ path: 't18-plot-attempt.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
