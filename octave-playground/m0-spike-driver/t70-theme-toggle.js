const { chromium } = require('playwright');

let pass = 0, fail = 0;
function check(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (ok) pass++; else fail++;
}

async function selectTheme(page, label) {
  await page.getByLabel('Theme').selectOption({ label });
  await page.waitForTimeout(300);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const base = 'http://localhost:4173/';

  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));
  await page.goto(base, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);

  // --- Default is dark (no localStorage entry yet) ---
  const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme ?? null);
  check('defaults to dark (no data-theme attribute set)', initialTheme === null);

  const bodyBgDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('dark body background is the dark app color', bodyBgDark === 'rgb(2, 6, 23)');

  // --- Select light ---
  await selectTheme(page, 'Light');
  const afterLightTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  check('selecting Light sets data-theme="light"', afterLightTheme === 'light');
  const bodyBgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('light body background is the light app color', bodyBgLight === 'rgb(248, 250, 252)');
  const storedLight = await page.evaluate(() => localStorage.getItem('engr183-theme'));
  check('Light choice persisted to localStorage', storedLight === 'light');

  // --- Select High Contrast ---
  await selectTheme(page, 'High Contrast');
  const afterHcTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  check('selecting High Contrast sets data-theme="high-contrast"', afterHcTheme === 'high-contrast');
  const bodyBgHc = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('high-contrast body background is pure black', bodyBgHc === 'rgb(0, 0, 0)');
  const bodyColorHc = await page.evaluate(() => getComputedStyle(document.body).color);
  check('high-contrast body text is pure white', bodyColorHc === 'rgb(255, 255, 255)');
  const storedHc = await page.evaluate(() => localStorage.getItem('engr183-theme'));
  check('High Contrast choice persisted to localStorage', storedHc === 'high-contrast');

  // --- Reload: high-contrast should survive via the inline FOUC-prevention script ---
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(300);
  const themeAfterReload = await page.evaluate(() => document.documentElement.dataset.theme);
  check('high-contrast theme survives a reload (inline script + localStorage)', themeAfterReload === 'high-contrast');

  // --- Representative element computed styles actually change ---
  const cardBorderHc = await page.evaluate(() => {
    const el = document.querySelector('li button, .flex.flex-col.gap-2 button');
    return el ? getComputedStyle(el).borderColor : null;
  });
  check('unit index card border is bright white in high-contrast (border carries structure)', cardBorderHc === 'rgb(255, 255, 255)');

  // --- Back to dark, confirm round-trip ---
  await selectTheme(page, 'Dark');
  const backToDark = await page.evaluate(() => document.documentElement.dataset.theme ?? null);
  check('selecting Dark clears data-theme (back to default)', backToDark === null);

  // --- Open a unit, check Monaco's theme class swaps across all 3 ---
  await page.goto(base + '?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 90000 });
  await page.waitForTimeout(500);

  async function monacoThemeClass() {
    return page.evaluate(() => {
      const el = document.querySelector('.monaco-editor');
      return el ? Array.from(el.classList).find((c) => c === 'vs' || c === 'vs-dark' || c === 'hc-black') : null;
    });
  }

  check('Monaco uses "vs-dark" when app theme is dark', (await monacoThemeClass()) === 'vs-dark');
  await selectTheme(page, 'Light');
  await page.waitForTimeout(500);
  check('Monaco uses "vs" when app theme is light', (await monacoThemeClass()) === 'vs');
  await selectTheme(page, 'High Contrast');
  await page.waitForTimeout(500);
  check('Monaco uses "hc-black" when app theme is high-contrast', (await monacoThemeClass()) === 'hc-black');

  // --- Accent button label is black-on-yellow in high-contrast, not the old white ---
  const runFileColor = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Run File');
    return btn ? getComputedStyle(btn).color : null;
  });
  check('Run File button label is black (not white) in high-contrast', runFileColor === 'rgb(0, 0, 0)');

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
