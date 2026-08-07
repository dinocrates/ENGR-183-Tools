const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto('http://localhost:8000/lab/index.html', { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(5000);

  await page.getByText('Text File', { exact: true }).click();
  await page.waitForTimeout(2000);
  await page.keyboard.type("function y = bridgeTest()\n  y = 4242;\nend\n", { delay: 5 });
  await page.keyboard.press('Control+S');
  await page.waitForTimeout(1000);

  const renameInput = page.locator('.jp-Dialog input[type="text"]');
  await renameInput.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('bridgeTest.m');
  await page.getByRole('button', { name: 'Rename and Save' }).click();
  await page.waitForTimeout(1500);

  await page.getByRole('menuitem', { name: 'File' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'file-menu-debug.png' });
  const menuItems = await page.locator('.lm-Menu-item').allTextContents();
  console.log('MENU ITEMS:', JSON.stringify(menuItems));
  await page.locator('.lm-Menu-item', { hasText: 'Create Console for Editor' }).click();
  await page.waitForTimeout(1000);

  const selectBtn = page.getByRole('button', { name: /^Select Kernel$|^Select$/ });
  if (await selectBtn.count()) {
    await selectBtn.first().click();
  }
  await page.waitForTimeout(5000);
  await page.screenshot({ path: 'lab-console-ready.png' });

  // Type into the console prompt to call bridgeTest() -- picking up the file
  // that was created purely through the file-browser/editor UI, not the mount.
  const editor = page.locator('.cm-content').last();
  await editor.click();
  await page.keyboard.insertText("addpath('/drive'); rehash; bridgeTest()");
  await page.keyboard.press('Shift+Enter');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: 'lab-console-result.png' });
  const outputs = await page.locator('.jp-OutputArea-output').allTextContents();
  console.log('=== console output after calling bridgeTest() ===');
  console.log(JSON.stringify(outputs, null, 2));

  // Now edit the file again through the editor UI and re-save, then call
  // again from the SAME console/kernel (no restart) to check live pickup.
  await page.locator('[data-type="document-title"]', { hasText: 'bridgeTest.m' }).click();
  await page.waitForTimeout(500);
  await page.keyboard.press('Control+A');
  await page.keyboard.insertText("function y = bridgeTest()\n  y = 9999;\nend\n");
  await page.keyboard.press('Control+S');
  await page.waitForTimeout(1500);

  await page.locator('[data-id="console-1"]').click();
  await page.waitForTimeout(500);
  const editor2 = page.locator('.cm-content').last();
  await editor2.click();
  await page.keyboard.insertText("rehash; bridgeTest()");
  await page.keyboard.press('Shift+Enter');
  await page.waitForTimeout(3000);
  const outputs2 = await page.locator('.jp-OutputArea-output').allTextContents();
  console.log('=== console output after editing + re-saving, same kernel ===');
  console.log(JSON.stringify(outputs2, null, 2));
  await page.screenshot({ path: 'lab-console-result2.png' });

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
