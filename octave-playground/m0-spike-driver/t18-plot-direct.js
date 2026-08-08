const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => logs.push(m.text()));
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));

  await page.goto('http://localhost:5183/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), { timeout: 30000 });

  const result = await page.evaluate(async () => {
    const session = (window).__session;
    const msgTypes = [];
    let out = '';
    try {
      await session.execute("plot([1 2 3],[4 5 6]); xlabel('x'); title('test'); disp('done')", (c) => { out += c.text; });
    } catch (e) {
      out += 'ERR: ' + e.message;
    }
    return out;
  });
  console.log('OUTPUT:', result);
  console.log('=== message types ===');
  console.log(logs.filter(l => l.includes('DEBUG msg_type')).join('\n---\n').slice(0, 5000));

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
