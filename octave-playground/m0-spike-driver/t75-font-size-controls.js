const { chromium } = require('playwright');

let pass = 0, fail = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (ok) pass++; else fail++;
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const base = 'http://localhost:4173/';

  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
  });
  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 90000 });
  await page.waitForTimeout(500);

  function monacoFontSize() {
    return page.evaluate(() => {
      const el = document.querySelector('.monaco-editor .view-lines');
      return el ? getComputedStyle(el).fontSize : null;
    });
  }
  function consoleFontSize() {
    return page.evaluate(() => {
      const pre = Array.from(document.querySelectorAll('pre')).find((p) => p.closest('.flex.h-full.flex-col.bg-app'));
      return pre ? getComputedStyle(pre).fontSize : null;
    });
  }

  const initialEditorSize = await monacoFontSize();
  check('editor starts at the default 13px', initialEditorSize === '13px');

  // Editor: increase then decrease
  const editorButtons = page.locator('.flex.items-center.border-b.border-line.bg-surface button');
  const editorIncrease = editorButtons.last();
  const editorDecrease = editorButtons.nth((await editorButtons.count()) - 2);

  await editorIncrease.click();
  await page.waitForTimeout(200);
  check('editor font size increases by 1px on A+ click', (await monacoFontSize()) === '14px');

  await editorDecrease.click();
  await editorDecrease.click();
  await page.waitForTimeout(200);
  check('editor font size decreases by 1px per A- click', (await monacoFontSize()) === '12px');

  // Persists across a unit remount (Playground uses key={unit.id})
  await page.goto(base, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(300);
  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 90000 });
  await page.waitForTimeout(500);
  check('editor font size persists across navigation (localStorage)', (await monacoFontSize()) === '12px');

  // Console window controls
  const initialConsoleSize = await consoleFontSize();
  check('console starts at the default 12px', initialConsoleSize === '12px');

  const consoleHeader = page.locator('div.flex.flex-shrink-0.items-center.gap-2.border-b.border-line', {
    hasText: 'Command Window',
  });
  const consoleButtons = consoleHeader.locator('button');
  const count = await consoleButtons.count();
  // Buttons in order: A-, A+, collapse toggle
  await consoleButtons.nth(count - 2).click();
  await page.waitForTimeout(200);
  check('console font size increases by 1px on A+ click', (await consoleFontSize()) === '13px');

  await consoleButtons.nth(count - 3).click();
  await consoleButtons.nth(count - 3).click();
  await page.waitForTimeout(200);
  check('console font size decreases by 1px per A- click', (await consoleFontSize()) === '11px');

  // Min/max clamping on the editor -- decrease until the button disables itself
  while (!(await editorDecrease.isDisabled())) {
    await editorDecrease.click();
  }
  await page.waitForTimeout(200);
  check('editor font size clamps at the 10px floor', (await monacoFontSize()) === '10px');
  check('A- button disables itself at the floor', await editorDecrease.isDisabled());

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
