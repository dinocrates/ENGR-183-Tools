// Real-kernel coverage: automatic snapshots, interaction, PNG/ZIP export,
// reload persistence, ZIP restoration, rerun cleanup, and removal/reset.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const JSZip = require('../node_modules/jszip');
const BASE = process.argv[2] || 'http://127.0.0.1:4180/';
const SCRIPT = `clear; clc; close all;
x = [1 2 3]; y = [3 6 9];
figure; plot(x, y, '-o'); xlabel('Time'); ylabel('Reading');
title('Saved primary'); legend('Sample series');
figure;
subplot(2,1,1); plot(x, y); title('Upper panel');
subplot(2,1,2); plot(x, -y); title('Lower panel');
disp('saved-example-complete');`;

(async () => {
  const browser = await chromium.launch();
  try {
    async function newPage() {
      const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
      await context.addInitScript(() => {
        localStorage.setItem('engr183-persistence-ack', '1');
        localStorage.setItem('engr183-onboarding-seen', '1');
      });
      const page = await context.newPage();
      page.on('pageerror', error => console.error('PAGE ERROR:', error.message));
      await page.goto(BASE + '?unit=scratch', { timeout: 90000 });
      await ready(page);
      return page;
    }
    async function ready(page) {
      await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 120000 });
    }
    const saved = page => page.locator('section[aria-label="Saved figures"] button[title^="Open "]');
    async function count(page, n) {
      await page.waitForFunction(n => document.querySelectorAll('section[aria-label="Saved figures"] button[title^="Open "]').length === n, n);
    }
    async function closeFigures(page) {
      while (await page.getByTitle('Close figure', { exact: true }).count()) {
        await page.getByTitle('Close figure', { exact: true }).last().click();
      }
    }
    async function run(page, code) {
      await closeFigures(page);
      await page.getByText('scratch.m', { exact: true }).first().click();
      await page.locator('.monaco-editor').click();
      await page.keyboard.press('Control+A');
      await page.keyboard.insertText(code);
      await page.getByRole('button', { name: 'Run File', exact: true }).click();
      // Waiting for this button to enable includes persistence after execute.
      await page.waitForFunction(() => ![...document.querySelectorAll('button')].find(b => b.textContent === 'Run File')?.disabled, null, { timeout: 90000 });
      const errors = (await page.getByRole('alert').allTextContents()).filter(t => t.trim());
      assert.equal(errors.length, 0, errors.join('\n'));
    }
    async function zipDownload(page) {
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 90000 }),
        page.getByRole('button', { name: 'Download All (.zip)', exact: true }).click(),
      ]);
      const bytes = fs.readFileSync(await download.path());
      return { bytes, zip: await JSZip.loadAsync(bytes) };
    }
    async function restore(page, bytes) {
      await closeFigures(page);
      await page.setInputFiles('input[type=file]', { name: 'scratch.zip', mimeType: 'application/zip', buffer: bytes });
      await page.getByRole('button', { name: 'Replace', exact: true }).click();
      await count(page, 2);
    }
    const page = await newPage();
    await run(page, SCRIPT);
    await count(page, 2);
    assert.deepEqual(await saved(page).allTextContents(), ['scratch_figure_1', 'scratch_figure_2']);
    await closeFigures(page);
    await saved(page).first().click();
    await page.waitForFunction(() => document.querySelector('.js-plotly-plot')?._fullLayout?.xaxis);
    const plot = page.locator('.js-plotly-plot');
    assert((await plot.locator('text').allTextContents()).includes('Saved primary'));
    const hover = await plot.evaluate(el => {
      const r = el.getBoundingClientRect(), l = el._fullLayout;
      return { x: r.x + l.xaxis._offset + l.xaxis.l2p(2), y: r.y + l.yaxis._offset + l.yaxis.l2p(6) };
    });
    await page.mouse.move(hover.x, hover.y);
    await page.waitForFunction(() => document.querySelector('.hovertext')?.textContent.includes('6'));
    const drag = await plot.locator('.nsewdrag').first().boundingBox();
    const originalRange = await plot.evaluate(el => [...el._fullLayout.xaxis.range]);
    await page.mouse.move(drag.x + drag.width * .2, drag.y + drag.height * .2);
    await page.mouse.down();
    await page.mouse.move(drag.x + drag.width * .75, drag.y + drag.height * .8, { steps: 8 });
    await page.mouse.up();
    await page.waitForFunction(range => JSON.stringify(document.querySelector('.js-plotly-plot')._fullLayout.xaxis.range) !== JSON.stringify(range), originalRange);
    await page.getByTitle('Minimize figure', { exact: true }).click();
    const first = await zipDownload(page);
    const paths = Object.keys(first.zip.files).filter(n => !first.zip.files[n].dir);
    assert(paths.includes('scratch.m'));
    assert.equal(paths.filter(n => n.endsWith('.png')).length, 2);
    assert.equal(paths.filter(n => n.endsWith('.figure.json')).length, 2);
    assert.equal((await first.zip.file('scratch.m').async('string')).replace(/\r\n/g, '\n'), SCRIPT);
    const snapshot = JSON.parse(await first.zip.file('figures/scratch_figure_1.figure.json').async('string'));
    assert.deepEqual(snapshot.plot.data[0].x, [1, 2, 3]);
    assert.deepEqual(snapshot.plot.data[0].y, [3, 6, 9]);
    assert.deepEqual(snapshot.plot.layout.xaxis.range, originalRange, 'UI zoom does not mutate the saved snapshot');
    const png = await first.zip.file('figures/scratch_figure_1.png').async('nodebuffer');
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(png.readUInt32BE(16), 560);
    assert.equal(png.readUInt32BE(20), 420);
    fs.writeFileSync('t135-saved-figure.png', png);
    console.log('PASS: automatic saving, interactive hover/zoom, PNG bytes, and ZIP export from a minimized figure');

    await page.reload(); await ready(page); await count(page, 2);
    assert.equal(await page.getByTitle('Close figure', { exact: true }).count(), 0);
    await saved(page).nth(1).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.annotation-text')].some(t => t.textContent === 'Upper panel'));
    assert((await page.locator('.js-plotly-plot text').allTextContents()).includes('Lower panel'));
    const [individual] = await Promise.all([
      page.waitForEvent('download'), page.getByTitle('Download scratch_figure_1.png', { exact: true }).click(),
    ]);
    assert.equal(individual.suggestedFilename(), 'scratch_figure_1.png');
    assert.equal(fs.readFileSync(await individual.path()).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    console.log('PASS: persistence after reload, saved subplots, and individual PNG download');

    const restored = await newPage();
    await restore(restored, first.bytes);
    await saved(restored).first().click();
    await restored.waitForFunction(() => document.querySelector('.js-plotly-plot')?.data?.[0]?.y?.[2] === 9);
    const roundtrip = await zipDownload(restored);
    const restoredData = JSON.parse(await roundtrip.zip.file('figures/scratch_figure_1.figure.json').async('string'));
    assert.deepEqual(restoredData.plot, snapshot.plot);
    assert(![...roundtrip.zip.file(/./)].some(f => f.name.includes('archive.json')));
    console.log('PASS: ZIP upload into a fresh browser restores interactive data and re-exports it');

    await closeFigures(restored);
    await restored.getByRole('button', { name: 'Reset unit', exact: true }).first().click();
    await restored.getByRole('button', { name: 'Reset unit', exact: true }).last().click();
    await count(restored, 0);
    await restore(restored, first.bytes);
    await run(restored, "clear; close all; plot([1 2], [10 20]); title('Replacement');");
    await count(restored, 1);
    const replaced = await zipDownload(restored);
    assert(!replaced.zip.file('figures/scratch_figure_2.png'));
    assert(JSON.parse(await replaced.zip.file('figures/scratch_figure_1.figure.json').async('string')).plot.layout.annotations.some(a => a.text.includes('Replacement')));
    console.log('PASS: Reset unit clears saved figures; successful reruns remove obsolete plots');

    await run(restored, "error('intentional failure');");
    await count(restored, 1);
    await run(restored, 'x = 42;');
    await count(restored, 0);
    await restore(restored, first.bytes);
    await restored.getByTitle('Remove saved figure scratch_figure_1', { exact: true }).click();
    await restored.getByRole('button', { name: 'Remove', exact: true }).click();
    await count(restored, 1);
    await restored.reload(); await ready(restored); await count(restored, 1);
    assert.equal(await saved(restored).first().textContent(), 'scratch_figure_2');
    console.log('PASS: failed runs preserve saved work, non-plot reruns clear old plots, and deletion persists');

    const bad = { ...snapshot, version: 99 };
    await restored.setInputFiles('input[type=file]', { name: 'bad.figure.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(bad)) });
    await restored.waitForFunction(() => document.querySelector('pre')?.textContent.includes('Not a supported saved figure'));
    await count(restored, 1);
    console.log('PASS: unsupported figure documents are rejected without altering saved work');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
