const { chromium } = require('playwright');

const SCRATCH = 'C:/Users/saham/AppData/Local/Temp/claude/c--Users-saham-OneDrive-Documents-ENGR-183-Tools/a828c4d0-9062-464a-a3fc-b3e22554deb7/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const base = 'http://localhost:4173/';

  await page.addInitScript(() => localStorage.setItem('engr183-persistence-ack', '1'));

  const LABELS = {
    dark: '🌙 Dark',
    light: '☀️ Light',
    'high-contrast': '⚡ High Contrast',
    retro: '🕹️ 8-Bit Retro',
    matrix: '💊 Matrix',
  };

  for (const theme of ['dark', 'light', 'high-contrast', 'retro', 'matrix']) {
    const label = LABELS[theme];
    await page.goto(base, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(300);
    if (theme !== 'dark') {
      await page.getByLabel('Theme').selectOption({ label });
      await page.waitForTimeout(300);
    }

    // Unit index
    await page.screenshot({ path: `${SCRATCH}/theme-${theme}-01-index.png` });

    // Open unit01, wait ready
    await page.goto(base + '?unit=unit01', { waitUntil: 'load', timeout: 30000 });
    await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 90000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${SCRATCH}/theme-${theme}-02-unit.png` });

    // Trigger a figure
    await page.click('.monaco-editor');
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText("x = 0:0.1:2*pi;\nplot(x, sin(x));\ndisp('done');");
    await page.getByText('Run File', { exact: true }).click();
    await page.waitForFunction(() => document.body.innerText.includes('done'), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${SCRATCH}/theme-${theme}-03-figure.png` });

    // Reset confirmation dialog
    await page.getByTitle('Discard changes to the current file, restoring the original starter').click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SCRATCH}/theme-${theme}-04-dialog.png` });
    await page.keyboard.press('Escape').catch(() => {});
    await page.getByText('Cancel', { exact: true }).click().catch(() => {});
  }

  await browser.close();
  console.log('done');
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
