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

  // --- Light ---
  await selectTheme(page, '☀️ Light');
  check('selecting Light sets data-theme="light"',
    (await page.evaluate(() => document.documentElement.dataset.theme)) === 'light');
  check('light body background is the light app color',
    (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(248, 250, 252)');

  // --- High Contrast ---
  await selectTheme(page, '⚡ High Contrast');
  check('selecting High Contrast sets data-theme="high-contrast"',
    (await page.evaluate(() => document.documentElement.dataset.theme)) === 'high-contrast');
  check('high-contrast body background is pure black',
    (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(0, 0, 0)');

  // --- 8-Bit Retro ---
  await selectTheme(page, '🕹️ 8-Bit Retro');
  check('selecting 8-Bit Retro sets data-theme="retro"',
    (await page.evaluate(() => document.documentElement.dataset.theme)) === 'retro');
  check('retro body background is NES navy',
    (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(13, 13, 43)');
  const storedRetro = await page.evaluate(() => localStorage.getItem('engr183-theme'));
  check('Retro choice persisted to localStorage', storedRetro === 'retro');

  // --- Matrix ---
  await selectTheme(page, '💊 Matrix');
  check('selecting Matrix sets data-theme="matrix"',
    (await page.evaluate(() => document.documentElement.dataset.theme)) === 'matrix');
  check('matrix body background is pure black',
    (await page.evaluate(() => getComputedStyle(document.body).backgroundColor)) === 'rgb(0, 0, 0)');
  check('matrix body text is matrix green',
    (await page.evaluate(() => getComputedStyle(document.body).color)) === 'rgb(0, 255, 65)');

  // --- Reload: matrix should survive via the inline FOUC-prevention script ---
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(300);
  check('matrix theme survives a reload (inline script + localStorage)',
    (await page.evaluate(() => document.documentElement.dataset.theme)) === 'matrix');

  // --- Back to dark ---
  await selectTheme(page, '🌙 Dark');
  check('selecting Dark clears data-theme (back to default)',
    (await page.evaluate(() => document.documentElement.dataset.theme ?? null)) === null);

  // --- Open a unit: Monaco theme swaps + font-pixel checks ---
  await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 90000 });
  await page.waitForTimeout(500);

  // Monaco's built-in themes (vs/vs-dark/hc-black) put their own name in
  // .monaco-editor's classList. Custom defineTheme() themes DON'T -- the
  // DOM class always reflects the theme's `base` (here, vs-dark for both
  // matrix and nes-retro), even though the custom color rules are genuinely
  // applied underneath. So built-ins are checked via classList, custom
  // themes via the actual rendered editor background color instead.
  async function monacoThemeClass() {
    return page.evaluate(() => {
      const el = document.querySelector('.monaco-editor');
      return el ? Array.from(el.classList).find((c) => ['vs', 'vs-dark', 'hc-black'].includes(c)) : null;
    });
  }
  async function monacoEditorBg() {
    return page.evaluate(() => {
      const bg = document.querySelector('.monaco-editor .monaco-editor-background');
      return bg ? getComputedStyle(bg).backgroundColor : null;
    });
  }
  function runFileFontFamily() {
    return page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Run File');
      return btn ? getComputedStyle(btn).fontFamily : null;
    });
  }

  check('Monaco uses "vs-dark" when app theme is dark', (await monacoThemeClass()) === 'vs-dark');
  check('Run File is NOT in the pixel font in dark mode', !(await runFileFontFamily()).includes('Press Start 2P'));

  await selectTheme(page, '☀️ Light');
  await page.waitForTimeout(500);
  check('Monaco uses "vs" when app theme is light', (await monacoThemeClass()) === 'vs');

  await selectTheme(page, '⚡ High Contrast');
  await page.waitForTimeout(500);
  check('Monaco uses "hc-black" when app theme is high-contrast', (await monacoThemeClass()) === 'hc-black');
  const runFileColorHc = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Run File');
    return btn ? getComputedStyle(btn).color : null;
  });
  check('Run File button label is black (not white) in high-contrast', runFileColorHc === 'rgb(0, 0, 0)');

  await selectTheme(page, '💊 Matrix');
  await page.waitForTimeout(500);
  check('Monaco "matrix" theme is applying its custom editor background', (await monacoEditorBg()) === 'rgb(0, 0, 0)');
  check('Run File is NOT in the pixel font in matrix mode (deliberately excluded)', !(await runFileFontFamily()).includes('Press Start 2P'));

  await selectTheme(page, '🕹️ 8-Bit Retro');
  await page.waitForTimeout(500);
  check('Monaco "nes-retro" theme is applying its custom editor background', (await monacoEditorBg()) === 'rgb(13, 13, 43)');
  check('Run File IS in the pixel font in retro mode', (await runFileFontFamily()).includes('Press Start 2P'));

  // --- Retro button label contrast (black-on-blue is intentional; just
  // confirm it's the retro on-accent value, not some leftover) ---
  const runFileColorRetro = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Run File');
    return btn ? getComputedStyle(btn).color : null;
  });
  check('Run File button label is white in retro (on-accent)', runFileColorRetro === 'rgb(255, 255, 255)');

  console.log(`\n${pass} passed, ${fail} failed`);
  await browser.close();
  if (fail > 0) process.exit(1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
