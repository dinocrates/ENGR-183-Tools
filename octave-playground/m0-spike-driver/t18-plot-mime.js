const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:5183/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), { timeout: 30000 });

  const result = await page.evaluate(async () => {
    const session = (window).__session;
    const displayData = [];
    const origExecute = session.execute.bind(session);
    // monkeypatch to capture raw messages by re-implementing a probe via the kernel directly is complex;
    // instead just capture via console -- but let's grab mime keys specifically using a custom hook.
    let mimeKeys = null;
    let dataPreview = null;
    // Access private kernel field isn't exposed; instead re-run with a wrapped stream and inspect console.
    return { note: 'see console DEBUG logs for full objects, mimeKeys will be printed there directly' };
  });

  // Instead, directly read message content by intercepting console.log with structured data via page.on('console')
  const page2msgs = [];
  page.on('console', async (msg) => {
    const args = msg.args();
    if (args.length >= 3) {
      try {
        const val = await args[2].jsonValue();
        if (val && val.data) {
          page2msgs.push(Object.keys(val.data));
        }
      } catch (e) {}
    }
  });

  await page.evaluate(async () => {
    const session = (window).__session;
    await session.execute("plot([1 2 3],[4 5 6]); title('t')", () => {});
  });
  await page.waitForTimeout(500);

  console.log('MIME type keys seen in display_data:', JSON.stringify(page2msgs));
  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
