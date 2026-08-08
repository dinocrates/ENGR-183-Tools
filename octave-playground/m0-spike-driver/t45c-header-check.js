const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto('http://localhost:8899/', { waitUntil: 'load', timeout: 30000 });
  const frameHandle = await page.$('#playground');
  const contentFrame = await frameHandle.contentFrame();

  await new Promise(r => setTimeout(r, 3000)); // let the COI service worker's self-reload attempt settle

  const swState = await contentFrame.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    return {
      registrations: regs.length,
      controller: !!navigator.serviceWorker.controller,
      crossOriginIsolated: window.crossOriginIsolated,
    };
  });
  console.log('service worker state inside iframe:', JSON.stringify(swState));

  // Compare: same check on the TOP-LEVEL page directly (not iframed) for reference
  const page2 = await browser.newPage();
  await page2.goto('https://dinocrates.github.io/ENGR-183-Tools/octave-playground/', { waitUntil: 'load', timeout: 30000 });
  await new Promise(r => setTimeout(r, 3000));
  const topLevelState = await page2.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    return {
      registrations: regs.length,
      controller: !!navigator.serviceWorker.controller,
      crossOriginIsolated: window.crossOriginIsolated,
    };
  });
  console.log('same check on top-level (non-iframed) page:', JSON.stringify(topLevelState));

  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
