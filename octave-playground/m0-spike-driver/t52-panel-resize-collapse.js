const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));

  await page.goto('http://localhost:5183/?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 });

  // --- RESIZE: drag the horizontal separator (sidebar vs main content) ---
  const fileBrowserHeader = page.getByText('File Browser', { exact: true });
  const sidebarBox = await fileBrowserHeader.locator('xpath=../..').boundingBox();
  console.log('sidebar width before:', Math.round(sidebarBox.width));

  const separators = page.locator('[data-separator]');
  const sepCount = await separators.count();
  console.log('number of separators found:', sepCount);

  // DOM order: [0] File Browser/Workspace divider (inside the sidebar's own
  // nested Group), [1] sidebar-vs-main-content (the outer horizontal-
  // orientation one, a vertical bar), [2] Editor/Command Window divider.
  const hSep = separators.nth(1);
  const hSepBox = await hSep.boundingBox();
  await page.mouse.move(hSepBox.x + hSepBox.width / 2, hSepBox.y + hSepBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(hSepBox.x + 150, hSepBox.y + hSepBox.height / 2, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(300);

  const sidebarBoxAfter = await fileBrowserHeader.locator('xpath=../..').boundingBox();
  console.log('sidebar width after drag:', Math.round(sidebarBoxAfter.width));
  console.log('sidebar grew correctly:', sidebarBoxAfter.width > sidebarBox.width + 100);

  // --- COLLAPSE / EXPAND: File Browser ---
  const fbCollapseBtn = page.locator('button[title="Collapse File Browser"]');
  await fbCollapseBtn.click();
  await page.waitForTimeout(300);
  const collapsedBox = await fileBrowserHeader.locator('xpath=../..').boundingBox();
  console.log('File Browser collapsed (short height):', collapsedBox.height < 50);
  // isVisible() doesn't account for a flex/overflow-clipped ancestor (the
  // collapsed panel itself), so it reports "visible" even for content
  // that's genuinely clipped out of view -- confirmed by screenshot during
  // development. Check geometry instead: the file button's position must
  // fall below the collapsed panel's own visible bottom edge.
  const collapsedPanelBox = await fileBrowserHeader.locator('xpath=../..').boundingBox();
  const fileBtnBox = await page.locator('ul button', { hasText: 'addTwo.m' }).boundingBox();
  const clippedOutOfView = fileBtnBox.y >= collapsedPanelBox.y + collapsedPanelBox.height;
  console.log('file list clipped out of view while collapsed:', clippedOutOfView);

  const fbExpandBtn = page.locator('button[title="Expand File Browser"]');
  console.log('expand button appears:', (await fbExpandBtn.count()) === 1);
  await fbExpandBtn.click();
  await page.waitForTimeout(300);
  const expandedBox = await fileBrowserHeader.locator('xpath=../..').boundingBox();
  console.log('File Browser expanded again:', expandedBox.height > 100);
  // addTwo.m appears twice (File Browser entry + Editor tab) -- scope to the
  // File Browser's own file-list button specifically.
  const filesVisibleAfterExpand = await page
    .locator('ul button', { hasText: 'addTwo.m' })
    .isVisible()
    .catch(() => false);
  console.log('file list visible again:', filesVisibleAfterExpand);

  // --- COLLAPSE Command Window, verify Editor gets more room ---
  const editorBoxBefore = await page.locator('.monaco-editor').first().boundingBox();
  const cwCollapseBtn = page.locator('button[title="Collapse Command Window"]');
  await cwCollapseBtn.click();
  await page.waitForTimeout(300);
  const editorBoxAfter = await page.locator('.monaco-editor').first().boundingBox();
  console.log('Editor grew when Command Window collapsed:', editorBoxAfter.height > editorBoxBefore.height + 50);

  // still functional after collapsing Command Window? re-expand and Run Tests
  const cwExpandBtn = page.locator('button[title="Expand Command Window"]');
  await cwExpandBtn.click();
  await page.waitForTimeout(300);
  await page.getByText('Run Tests', { exact: true }).click();
  await page.waitForFunction(() => /Score: \d+\/30/.test(document.body.innerText), null, { timeout: 30000 });
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('Run Tests still works after panel resize/collapse:', /Score: \d+\/30 points/.test(bodyText));

  await page.screenshot({ path: 't52-result.png' });
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
