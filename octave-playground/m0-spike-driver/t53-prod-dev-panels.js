const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const base = 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground-dev/';

  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.getByText('Got it', { exact: true }).click({ timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 60000 });

  const fileBrowserHeader = page.getByText('File Browser', { exact: true });
  const sidebarBefore = await fileBrowserHeader.locator('xpath=../..').boundingBox();

  const separators = page.locator('[data-separator]');
  console.log('dev: separator count:', await separators.count());
  const hSep = separators.nth(1);
  const hSepBox = await hSep.boundingBox();
  await page.mouse.move(hSepBox.x + hSepBox.width / 2, hSepBox.y + hSepBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(hSepBox.x + 150, hSepBox.y + hSepBox.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const sidebarAfter = await fileBrowserHeader.locator('xpath=../..').boundingBox();
  console.log('dev: sidebar widened via drag:', sidebarAfter.width > sidebarBefore.width + 100);

  await page.locator('button[title="Collapse File Browser"]').click();
  await page.waitForTimeout(300);
  const collapsedBox = await fileBrowserHeader.locator('xpath=../..').boundingBox();
  console.log('dev: File Browser collapsed:', collapsedBox.height < 50);

  await page.locator('button[title="Expand File Browser"]').click();
  await page.waitForTimeout(300);
  const expandedBox = await fileBrowserHeader.locator('xpath=../..').boundingBox();
  console.log('dev: File Browser expanded back:', expandedBox.height > 100);

  await page.getByText('Run Tests', { exact: true }).click();
  await page.waitForFunction(() => /Score: \d+\/30/.test(document.body.innerText), null, { timeout: 30000 });
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('dev: Run Tests still works after panel ops:', /Score: \d+\/30 points/.test(bodyText));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
