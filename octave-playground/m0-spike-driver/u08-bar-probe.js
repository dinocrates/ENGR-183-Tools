const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({viewport:{width:1400,height:1100}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.stack));
  await page.addInitScript(()=>{localStorage.setItem('engr183-persistence-ack','1');localStorage.setItem('engr183-onboarding-seen','1');});
  await page.goto(new URL('?unit=scratch', process.argv[2] || 'http://127.0.0.1:4188/').href);
  const ready=()=>page.getByPlaceholder(/Type an Octave command/).waitFor({timeout:60000}); await ready();
  try {
  const code="close all; figure; b=bar(1:3,[-20 50 100]); set(b,'ydata',[-10 60 95]); hold on; plot([0.5 3.5],[80 80],'k--'); hold off; title('Updated bar geometry'); xlabel('System'); ylabel('Percent'); ylim([-25 100]); disp(get(b,'ydata')); disp(get(get(b,'children'),'ydata')); disp('PROBE_DONE');";
  await page.locator('.monaco-editor').click();await page.keyboard.press('Control+A');await page.keyboard.insertText(code);
  await page.getByRole('button',{name:'Run File',exact:true}).click(); await ready();
  await page.locator('.js-plotly-plot .main-svg').first().waitFor();
  assert.equal(await page.locator('.barlayer .point').count(),3);
  await page.waitForFunction(()=>[...document.querySelectorAll('.js-plotly-plot')].some(p=>p.data?.some(t=>t.type==='bar' && t.y?.[0]===-10)),null,{timeout:10000});
  let bars=await page.locator('.js-plotly-plot').evaluate(p=>p.data.filter(t=>t.type==='bar'));
  assert.deepEqual(bars.map(t=>t.y),[[-10,60,95]]);
  console.log('PASS native bar handles, changed ydata, negative values and rendered rectangles');
  const input=page.getByPlaceholder(/Type an Octave command/);
  await input.fill("cla; plot([1 2],[3 4]); title('Cleared bars'); disp('CLEARED');"); await input.press('Enter'); await ready();
  await page.waitForFunction(()=>[...document.querySelectorAll('.js-plotly-plot')].at(-1)?.data?.every(t=>t.type!=='bar'));
  assert.equal(await page.locator('.js-plotly-plot').last().locator('.barlayer .point').count(),0);
  console.log('PASS cla removes bar supplements');
  await input.fill("close all; figure; b=bar([10 20;30 40]); title('Grouped bars'); disp('GROUPED');"); await input.press('Enter'); await ready();
  await page.waitForFunction(()=>[...document.querySelectorAll('.js-plotly-plot')].at(-1)?.querySelectorAll('.barlayer .point').length===4);
  bars=await page.locator('.js-plotly-plot').last().evaluate(p=>p.data.filter(t=>t.type==='bar'));
  assert.deepEqual(bars.map(t=>t.y).sort((a,b)=>a[0]-b[0]),[[10,30],[20,40]]);
  assert.deepEqual(errors,[]);
  console.log('PASS grouped native geometry and repeat plotting');
  } finally {
    fs.writeFileSync('u08-bar-probe.json',JSON.stringify({errors,output:await page.locator('pre').allTextContents(),plots:await page.locator('.js-plotly-plot').evaluateAll(ps=>ps.map(p=>({data:p.data,layout:p.layout})))},null,2));
    await page.screenshot({path:'u08-bar-probe.png'});await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
