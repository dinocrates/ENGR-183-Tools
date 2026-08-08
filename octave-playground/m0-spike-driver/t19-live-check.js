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
  const logs = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));

  console.log('navigating to live site...');
  await page.goto('https://dinocrates.github.io/ENGR-183-Tools/octave-playground/', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  try {
    await page.waitForFunction(
      () => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'),
      { timeout: 60000 }
    );
  } catch (e) {
    console.log('TIMED OUT waiting for Ready/Error');
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: 't19-live-initial.png' });

  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 100));
  console.log('STATUS AREA:', bodyText.includes('Ready') ? 'READY' : bodyText.includes('Error') ? 'ERROR' : 'UNKNOWN: ' + bodyText);

  if (bodyText.includes('Ready')) {
    await setFileContent(page, 'addTwo.m', "function s = addTwo(a, b)\n  s = a + b;\nend\n");
    await setFileContent(page, 'circleArea.m', "function a = circleArea(r)\n  a = pi * r^2;\nend\n");
    await setFileContent(page, 'greet.m', "function s = greet(name)\n  s = ['Hello, ' name '!'];\nend\n");

    await page.getByText('Run Tests', { exact: true }).click();
    await page.waitForFunction(() => document.body.innerText.includes('Ready') || document.body.innerText.includes('Error'), { timeout: 20000 });
    await page.waitForTimeout(500);

    const output = await page.locator('pre').textContent();
    console.log('=== Run Tests output ===');
    console.log(output);
    await page.screenshot({ path: 't19-live-runtests.png' });
  }

  console.log('=== console logs (last 30) ===');
  console.log(logs.slice(-30).join('\n'));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
