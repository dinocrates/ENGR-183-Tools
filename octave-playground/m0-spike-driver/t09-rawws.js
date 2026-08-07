// The generic @jupyterlab/services ServiceManager doesn't work out of the box
// against jupyterlite (POST /api/kernels and GET /api/kernelspecs both miss
// the service worker entirely -- jupyterlite-xeus creates kernels via direct
// JS calls, not a REST endpoint). But the built app DOES open a real
// WebSocket to talk to an already-running kernel ("Starting WebSocket:
// ws://localhost:8000/api/kernels/<id>"). This test grabs that kernel's id
// from the console log and speaks the Jupyter kernel wire protocol to it
// directly over that WebSocket -- no notebook UI, no REPL input box touched.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let kernelId = null;
  const logs = [];
  page.on('console', (msg) => {
    const t = msg.text();
    logs.push(`[console.${msg.type()}] ${t}`);
    const m = t.match(/Starting WebSocket: ws:\/\/[^/]+\/api\/kernels\/([a-f0-9-]+)/);
    if (m) kernelId = m[1];
  });
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

  const url = 'http://localhost:8000/repl/index.html?kernel=xoctave&toolbar=1';
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(4000);

  console.log('Observed kernel id:', kernelId);
  if (!kernelId) {
    console.log(logs.join('\n'));
    throw new Error('never saw a kernel id in the console log');
  }

  const result = await page.evaluate(async (kernelId) => {
    return await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:8000/api/kernels/${kernelId}`);
      let output = '';
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          resolve({ timedOut: true, output });
        }
      }, 15000);

      ws.onopen = () => {
        const msg = {
          header: {
            msg_id: 'm0spike-1',
            username: 'm0spike',
            session: 'm0spike',
            date: new Date().toISOString(),
            msg_type: 'execute_request',
            version: '5.3',
          },
          parent_header: {},
          metadata: {},
          content: {
            code: [
              "a = 2 + 3",
              "b = [1 2 3] * 2",
              "for i = 1:3, printf('%d ', i); end",
              "function y = sq(x), y = x^2; end",
              "printf('sq(4)=%d\\n', sq(4))",
              "try, error('boom'); catch err, printf('caught: %s\\n', err.message); end",
            ].join(";\n"),
            silent: false,
            store_history: true,
            user_expressions: {},
            allow_stdin: false,
            stop_on_error: true,
          },
          buffers: [],
          channel: 'shell',
        };
        ws.send(JSON.stringify(msg));
      };

      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          output += `\n[${data.channel}/${data.header && data.header.msg_type}] ` + JSON.stringify(data.content).slice(0, 300);
          if (data.header && data.header.msg_type === 'execute_reply') {
            settled = true;
            clearTimeout(timer);
            resolve({ timedOut: false, output });
          }
        } catch (e) {
          output += '\n[parse-error] ' + String(e) + ' raw=' + String(ev.data).slice(0, 200);
        }
      };
      ws.onerror = (ev) => {
        output += '\n[ws-error]';
      };
      ws.onclose = (ev) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve({ closed: true, code: ev.code, reason: ev.reason, output });
        }
      };
    });
  }, kernelId);

  console.log('RESULT:', JSON.stringify(result, null, 2));
  await browser.close();
})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
