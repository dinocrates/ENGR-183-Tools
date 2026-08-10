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

  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));
  await page.goto(base, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(500);

  // --- Default is dark (no localStorage entry yet) ---
  const initialTheme = await page.evaluate(() => document.documentElement.dataset.theme ?? null);
  check('defaults to dark (no data-theme attribute set)', initialTheme === null);

  const bodyBgDark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log('body bg (dark):', bodyBgDark);
  check('dark body background is the dark app color', bodyBgDark === 'rgb(2, 6, 23)');

  // --- Toggle to light ---
  await page.getByTitle('Switch to light theme').click();
  await page.waitForTimeout(300);
  const afterToggleTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  check('toggling sets data-theme="light"', afterToggleTheme === 'light');

  const bodyBgLight = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  console.log('body bg (light):', bodyBgLight);
  check('light body background actually changed (CSS variable override took effect)', bodyBgLight !== bodyBgDark);
  check('light body background is the light app color', bodyBgLight === 'rgb(248, 250, 252)');

  const storedTheme = await page.evaluate(() => localStorage.getItem('engr183-theme'));
  check('theme choice persisted to localStorage', storedTheme === 'light');

  // --- Reload: light theme should survive via the inline FOUC-prevention script ---
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(300);
  const themeAfterReload = await page.evaluate(() => document.documentElement.dataset.theme);
  check('light theme survives a reload (inline script + localStorage)', themeAfterReload === 'light');
  const bodyBgAfterReload = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  check('light body background still correct immediately after reload (no FOUC flash to check visually, but confirms the value)', bodyBgAfterReload === 'rgb(248, 250, 252)');

  // --- Representative element computed styles change between themes ---
  await page.getByTitle('Switch to dark theme').click();
  await page.waitForTimeout(300);
  const cardBorderDark = await page.evaluate(() => {
    const el = document.querySelector('li button, .flex.flex-col.gap-2 button');
    return el ? getComputedStyle(el).borderColor : null;
  });
  await page.getByTitle('Switch to light theme').click();
  await page.waitForTimeout(300);
  const cardBorderLight = await page.evaluate(() => {
    const el = document.querySelector('li button, .flex.flex-col.gap-2 button');
    return el ? getComputedStyle(el).borderColor : null;
  });
  console.log('unit card border dark/light:', cardBorderDark, cardBorderLight);
  check('unit index card border color changes between themes', cardBorderDark !== null && cardBorderDark !== cardBorderLight);

  // --- Open a unit, check Monaco's theme class swaps ---
  await page.goto(base + '?unit=scratch', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 90000 });
  await page.waitForTimeout(500);

  const monacoThemeLight = await page.evaluate(() => {
    const el = document.querySelector('.monaco-editor');
    return el ? Array.from(el.classList).find((c) => c === 'vs' || c === 'vs-dark') : null;
  });
  console.log('Monaco theme class while app theme = light:', monacoThemeLight);
  check('Monaco uses the light "vs" theme when app theme is light', monacoThemeLight === 'vs');

  await page.getByTitle('Switch to dark theme').click();
  await page.waitForTimeout(500);
  const monacoThemeDark = await page.evaluate(() => {
    const el = document.querySelector('.monaco-editor');
    return el ? Array.from(el.classList).find((c) => c === 'vs' || c === 'vs-dark') : null;
  });
  console.log('Monaco theme class while app theme = dark:', monacoThemeDark);
  check('Monaco swaps to "vs-dark" when app theme toggles back to dark', monacoThemeDark === 'vs-dark');

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
