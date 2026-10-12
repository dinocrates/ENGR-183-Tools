// Real WASM/IOPub/Plotly regression. Build first and serve with vite preview.
// node m0-spike-driver/u08-bar-legend.js http://127.0.0.1:4188/
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const JSZip = require('../node_modules/jszip');
const full = fs.readFileSync(path.join(__dirname, 'fixtures/u08-bar-legend.m'), 'utf8');
const withoutLegend = full.replace(/legend\('Performance'[\s\S]*?'northwest'\);/, '');
const expected = [100 * (53 / 119), 100 * (107 / 119), 100];
const evidence = [];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, acceptDownloads: true });
  const errors = [];
  let failure = null;
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
  });
  const ready = () => page.getByPlaceholder(/Type an Octave command/).waitFor({ timeout: 60000 });
  const output = async () => (await page.locator('pre').allTextContents()).join('\n');
  async function closeWindows() {
    const close = page.getByTitle('Close figure', { exact: true });
    while (await close.count()) await close.last().click();
  }
  async function run(code, label) {
    await closeWindows(); await ready();
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+A'); await page.keyboard.insertText(code);
    const start = Date.now();
    await page.getByRole('button', { name: 'Run File', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('pre')].some(p => p.textContent.includes('RENDER TEST COMPLETED')), null, { timeout: 30000 });
    await ready();
    assert.doesNotMatch(await output(), /error:|warning:|Error:/i);
    evidence.push({ label, seconds: (Date.now() - start) / 1000 });
    console.log(`PASS ${label}: Ready in ${evidence.at(-1).seconds.toFixed(2)}s`);
  }
  function checkData(plot, legend) {
    const bars = plot.data.filter(t => t.type === 'bar');
    assert.equal(bars.length, 1);
    assert.deepEqual(bars[0].x, [1, 2, 3]); assert.deepEqual(bars[0].y, expected);
    const xaxis = plot.layout[bars[0].xaxis.replace('x', 'xaxis')];
    assert.deepEqual(xaxis.ticktext, ['A', 'B', 'C']);
    assert.ok(plot.data.some(t => t.x?.[0] === 0.5 && t.x?.[1] === 3.5 && t.y?.every(y => y === 80) && t.line?.dash === 'dash'));
    const annotations = plot.layout.annotations ?? [];
    const performance = annotations.find(a => a.text === 'Performance');
    assert.equal(!!performance, legend);
    if (legend) {
      const reference = annotations.find(a => a.text === 'Minimum Required (80%)');
      assert.ok(reference);
      assert.ok(plot.data.some(t => t.fill === 'toself' && t.xaxis === performance.xref && t.yaxis === performance.yref && t.fillcolor === bars[0].marker.color));
      assert.ok(plot.data.some(t => t.xaxis === reference.xref && t.yaxis === reference.yref && t.line?.dash === 'dash' && t.y?.every(y => y === reference.y)));
    }
  }
  async function checkLive(legend) {
    await page.waitForFunction(() => {
      const plots = [...document.querySelectorAll('.js-plotly-plot')];
      return plots.length === 2 && plots.every(p => p._fullLayout && p.querySelector('.main-svg')) && plots.some(p => p.querySelectorAll('.barlayer .point').length === 3);
    }, null, { timeout: 30000 });
    const plots = await page.locator('.js-plotly-plot').evaluateAll(ps => ps.map(p => ({ data: p.data, layout: p.layout })));
    const bar = plots.find(p => p.data.some(t => t.type === 'bar'));
    checkData(bar, legend);
    const line = plots.find(p => !p.data.some(t => t.type === 'bar'));
    for (const label of ['System A', 'System B', 'System C', 'Required Power (100 W)']) {
      assert.ok(line.layout.annotations.some(a => a.text === label));
      assert.ok((await page.locator('.annotation-text').allTextContents()).includes(label));
    }
    if (legend) {
      const plot = page.locator('.js-plotly-plot').filter({ has: page.locator('.barlayer') });
      assert.equal(await plot.locator('.scatterlayer .js-fill').count(), 1, 'bar legend sample is an actual filled SVG path');
      assert.ok((await plot.locator('.annotation-text').allTextContents()).includes('Performance'));
      assert.ok((await plot.locator('.annotation-text').allTextContents()).includes('Minimum Required (80%)'));
    }
    assert.equal(await page.getByText('Rendering…', { exact: true }).count(), 0);
  }
  try {
    await page.goto(new URL('?unit=u08-project-solar-station', process.argv[2] || 'http://127.0.0.1:4188/').href);
    await ready();
    const csv = fs.readFileSync(path.join(__dirname, '../../engr183-harness/assignments/u08-project-solar-station/solar_station_measurements.csv'));
    const hash = crypto.createHash('sha256').update(csv).digest('hex');
    // Verify the normal Unit 8 preload, never upload/generated replacement data.
    const input = page.getByPlaceholder(/Type an Octave command/);
    await input.fill("disp(['CSV_SHA=' hash('sha256',fileread('solar_station_measurements.csv'))]);"); await input.press('Enter'); await ready();
    assert.ok((await output()).includes(`CSV_SHA=${hash}`));
    await run(withoutLegend, 'otherwise identical control without Figure 2 legend'); await checkLive(false);
    for (let i = 1; i <= 3; i++) {
      await run(full, `complete reproduction with both legends, run ${i}`); await checkLive(true);
    }
    const live = page.locator('.js-plotly-plot').filter({ has: page.locator('.barlayer') });
    await live.screenshot({ path: path.join(__dirname, 'u08-bar-legend.png') });
    const cameraPending = page.waitForEvent('download');
    await live.locator('[data-title*="Download plot"]').click();
    await (await cameraPending).saveAs(path.join(__dirname, 'u08-bar-legend-camera.png'));
    await closeWindows();
    const saved = page.getByRole('region', { name: 'Saved figures' });
    assert.equal(await saved.locator('li').count(), 2);
    await saved.getByTitle(/Open .*interactive saved figure/).nth(1).click();
    const reopened = page.locator('.js-plotly-plot');
    await reopened.locator('.barlayer .point').first().waitFor();
    checkData(await reopened.evaluate(p => ({ data: p.data, layout: p.layout })), true);
    assert.equal(await reopened.locator('.scatterlayer .js-fill').count(), 1);
    await closeWindows();
    const pngPending = page.waitForEvent('download');
    await saved.getByTitle(/Download .*\.png/).nth(1).click();
    const png = await pngPending;
    await png.saveAs(path.join(__dirname, 'u08-bar-legend-saved.png'));
    const zipPending = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download All/ }).click();
    const zip = await JSZip.loadAsync(fs.readFileSync(await (await zipPending).path()));
    const figures = Object.keys(zip.files).filter(n => n.endsWith('.figure.json'));
    assert.equal(figures.length, 2);
    const documents = await Promise.all(figures.map(async n => JSON.parse(await zip.file(n).async('string'))));
    checkData(documents.find(f => f.plot.data.some(t => t.type === 'bar')).plot, true);
    assert.equal(Object.keys(zip.files).filter(n => n.endsWith('.png')).length, 2);
    for (const suffix of ['camera', 'saved']) {
      const bytes = fs.readFileSync(path.join(__dirname, `u08-bar-legend-${suffix}.png`));
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      assert.equal(bytes.readUInt32BE(16), 560); assert.equal(bytes.readUInt32BE(20), 420);
    }
    console.log('PASS saved figure reopening and real camera, saved PNG, and ZIP exports');
    await run(`clear; clc; close all;
      figure; b=bar(1:3,[44.538 89.916 100]); hold on;
      r=plot([0.5 3.5],[80 80],'k--');
      [hl,icons,peers]=legend([b r],{'Performance','Minimum Required (80%)'},'Location','northwest');
      hold off; drawnow; assert(strcmp(get(hl,'location'),'northwest'));
      assert(all(ishghandle(icons))); assert(isequal(peers(:),[b;r]));
      set(b,'facecolor',[1 0 0]); set(b,'ydata',[40 90 100]); drawnow;
      assert(strcmp(get(hl,'location'),'northwest'));
      set(hl,'units','normalized','position',[0.6 0.6 0.25 0.15]); drawnow;
      assert(strcmp(get(hl,'location'),'none')); assert(ishghandle(b) && ishghandle(r));
      disp('RENDER TEST COMPLETED');`, 'single-execution synthetic bars, handles, live color/data updates and manual legend position');
    await page.waitForFunction(() => [...document.querySelectorAll('.js-plotly-plot')].some(p => p.data?.some(t => t.type === 'bar' && t.y?.[0] === 40 && t.marker.color === 'rgb(255,0,0)') && p.data?.some(t => t.fill === 'toself' && t.fillcolor === 'rgb(255,0,0)')));
    assert.deepEqual(errors, []);
    console.log('PASS native handles and live bar/legend semantics');
  } catch (error) {
    failure = error.stack;
    throw error;
  } finally {
    fs.writeFileSync(path.join(__dirname, 'u08-bar-legend-results.json'), JSON.stringify({ failure, evidence, errors, output: await output() }, null, 2));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
