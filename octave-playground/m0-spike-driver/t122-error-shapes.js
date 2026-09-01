// One-off: dump the raw kernel `error` / `execute_reply` content for several
// error KINDS (parse error, explicit error(), undefined variable, index out
// of bound) so formatKernelError() handles each without dropping detail.
const { chromium } = require('playwright');
const BASE = process.argv[2] || 'https://dinocrates.github.io/ENGR-183-Tools/octave-playground/';

const CMDS = [
  'x = ',                       // parse error
  "error('something broke')",   // explicit error, no id
  "error('MyPkg:bad', 'bad %d', 3)", // explicit error with id
  'zzz + 1',                    // undefined variable
  'v = [1 2 3]; v(9)',          // index out of bound
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
    window.__hits = [];
    const OW = window.Worker;
    window.Worker = new Proxy(OW, {
      construct(t, a) {
        const w = new t(...a);
        w.addEventListener('message', (ev) => {
          let s; try { s = JSON.stringify(ev.data); } catch { s = ''; }
          if (s && /"msg_type":"(error|execute_reply)"/.test(s) && /traceback/.test(s)) window.__hits.push(s);
        });
        return w;
      },
    });
  });
  await page.goto(BASE + '?unit=u04-gp04-thermal-monitor', { waitUntil: 'load', timeout: 90000 });
  await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 240000 });
  await page.waitForTimeout(1000);
  const input = page.getByPlaceholder(/Type an Octave command|Continue the block/);
  for (const c of CMDS) {
    await page.evaluate(() => (window.__hits.length = 0));
    await input.fill(c);
    await input.press('Enter');
    await page.waitForTimeout(4000);
    const hits = await page.evaluate(() => window.__hits.slice());
    console.log(`\n===== ${JSON.stringify(c)} =====`);
    for (const h of hits) {
      const m = JSON.parse(h);
      console.log(m.header.msg_type, '::', JSON.stringify({ ename: m.content.ename, evalue: m.content.evalue, traceback: m.content.traceback }, null, 1));
    }
  }
  await browser.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
