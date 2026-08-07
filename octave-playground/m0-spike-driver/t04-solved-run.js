const { chromium } = require('playwright');
const { runCell } = require('./console-driver.js');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:8000/repl/index.html?kernel=xoctave&toolbar=1', {
    waitUntil: 'networkidle', timeout: 60000,
  });
  await page.waitForTimeout(4000);

  const copyCode = `
function copyViaIO(src, dst)
  content = fileread(src);
  fid = fopen(dst, 'w');
  fputs(fid, content);
  fclose(fid);
end
copyViaIO('/engr183-solved/addTwo.m', '/engr183/assignments/unit00/addTwo.m')
copyViaIO('/engr183-solved/circleArea.m', '/engr183/assignments/unit00/circleArea.m')
copyViaIO('/engr183-solved/greet.m', '/engr183/assignments/unit00/greet.m')
rehash
`;
  const wOut = await runCell(page, copyCode);
  console.log('=== copy solved via fileread/fputs ===');
  console.log(wOut);

  const out2 = await runCell(page, "addpath('/engr183'); addpath('/engr183/tests'); engr183.runTests('unit00')");
  console.log('=== SOLVED (mounted, expect 6/6) ===');
  console.log(out2);

  await browser.close();
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
