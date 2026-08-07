// Exploratory script: open the REPL app (minimal chrome, no notebook), see
// what's on `window` that might let us drive the kernel programmatically
// (T0.9), and confirm the kernel starts at all (T0.2 precursor).
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleMsgs = [];
  page.on('console', (msg) => consoleMsgs.push(`[console.${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => consoleMsgs.push(`[pageerror] ${err.message}`));

  await page.goto('http://localhost:8000/repl/index.html?kernel=xoctave&toolbar=1', {
    waitUntil: 'networkidle',
    timeout: 60000,
  });

  await page.waitForTimeout(5000);

  const globalKeys = await page.evaluate(() => {
    return Object.keys(window).filter((k) =>
      /jupyter|service|kernel|app|lite/i.test(k)
    );
  });

  const title = await page.title();
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 500));

  console.log('TITLE:', title);
  console.log('INTERESTING WINDOW KEYS:', JSON.stringify(globalKeys));
  console.log('BODY TEXT SNIPPET:', bodyText);
  console.log('--- console/page messages ---');
  console.log(consoleMsgs.slice(0, 60).join('\n'));

  await page.screenshot({ path: 'explore.png', fullPage: true });

  await browser.close();
})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
