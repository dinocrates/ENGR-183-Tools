const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const JSZip = require('../node_modules/jszip');
const BASE = process.argv[2] || 'http://127.0.0.1:4180/';
const SCRIPT = `clear; clc; close all;
time_min = 0:12;
temp_A_C = [25 34 42 49 55 60 64 67 69 71 72 73 74];
temp_B_C = [25 32 37 41 44 46 47 48 49 49 50 50 50];
limit_C = 70;
figure;
plot(time_min, temp_A_C, '-o', 'LineWidth', 2); hold on;
plot(time_min, temp_B_C, '--s', 'LineWidth', 2);
plot([0 12], [limit_C limit_C], 'k--', 'LineWidth', 1.5); hold off;
xlabel('Time (min)'); ylabel('Temperature (C)');
title('Cooling comparison at the same heat load');
legend('Configuration A', 'Configuration B', 'Design limit', 'Location', 'northwest');
grid on; xlim([0 12]); ylim([20 85]);`;

(async () => {
 const browser = await chromium.launch();
 try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.addInitScript(() => {
    localStorage.setItem('engr183-persistence-ack', '1');
    localStorage.setItem('engr183-onboarding-seen', '1');
    window.legendBounds = el => [...el.querySelectorAll('.annotation-text')]
      .filter(t => ['Configuration A', 'Configuration B', 'Design limit'].includes(t.textContent))
      .map(t => {
        const annotation = el.layout.annotations[Number(t.closest('.annotation').getAttribute('data-index'))];
        const xaxis = el._fullLayout['xaxis' + annotation.xref.slice(1)];
        const yaxis = el._fullLayout['yaxis' + annotation.yref.slice(1)];
        const canvas = el.getBoundingClientRect();
        const label = t.getBoundingClientRect();
        return {
          text: t.textContent,
          left: label.left - (canvas.left + xaxis._offset),
          right: canvas.left + xaxis._offset + xaxis._length - label.right,
          top: label.top - (canvas.top + yaxis._offset),
          bottom: canvas.top + yaxis._offset + yaxis._length - label.bottom,
        };
      });
  });
  await page.goto(BASE + '?unit=scratch', { timeout: 90000 });
  await page.waitForFunction(() => [...document.querySelectorAll('span')].some(s => s.textContent === 'Ready'), null, { timeout: 90000 });
  async function closeFigures() {
    while (await page.getByTitle('Close figure', { exact: true }).count()) {
      await page.getByTitle('Close figure', { exact: true }).last().click();
    }
  }
  async function run(code) {
    await closeFigures();
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(code);
    await page.getByRole('button', { name: 'Run File', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Run File' && !b.disabled), null, { timeout: 90000 });
    await page.waitForFunction(() => [...document.querySelectorAll('.annotation-text')].some(t => t.textContent === 'Configuration A'));
  }
  function checkBounds(rows, context) {
    assert.equal(rows.length, 3, context + ': all three labels render');
    for (const row of rows) {
      for (const side of ['left', 'right', 'top', 'bottom']) {
        assert(row[side] >= 0.5, `${context}: ${row.text} must be inside ${side} border (padding ${row[side].toFixed(2)}px)`);
      }
    }
  }
  const plot = page.locator('.js-plotly-plot').first();
  async function checkPlot(context) {
    checkBounds(await plot.evaluate(el => window.legendBounds(el)), context);
    const texts = await plot.locator('text').allTextContents();
    for (const label of ['Time (min)', 'Temperature (C)', 'Cooling comparison at the same heat load']) assert(texts.includes(label));
    assert.equal(await plot.locator('.legendtext').count(), 0, 'No duplicate native Plotly legend');
  }
  await run(SCRIPT);
  await checkPlot('Original example');
  await plot.screenshot({ path: 't139-legend.png' });
  console.log('PASS: original example labels fit within all four legend borders; title and axes remain visible');

  // Capture the actual offscreen renderer used for file/ZIP PNG exports.
  await page.evaluate(() => {
    window.exportLegendBounds = [];
    new MutationObserver(() => {
      for (const el of document.querySelectorAll('[aria-hidden="true"].js-plotly-plot')) {
        if (!el._fullLayout) continue;
        const rows = window.legendBounds(el);
        if (rows.length === 3) window.exportLegendBounds = rows;
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  const saved = page.locator('section[aria-label="Saved figures"]');
  const [png] = await Promise.all([
    page.waitForEvent('download'), saved.getByRole('button', { name: 'PNG', exact: true }).click(),
  ]);
  await png.saveAs('t139-legend-export.png');
  checkBounds(await page.evaluate(() => window.exportLegendBounds), 'PNG export');
  await closeFigures();
  await saved.locator('button[title^="Open "]').first().click();
  await page.waitForFunction(() => [...document.querySelectorAll('.annotation-text')].some(t => t.textContent === 'Configuration A'));
  await checkPlot('Reopened saved figure');
  const [download] = await Promise.all([
    page.waitForEvent('download'), page.getByRole('button', { name: 'Download All (.zip)', exact: true }).click(),
  ]);
  const zip = await JSZip.loadAsync(fs.readFileSync(await download.path()));
  const figure = JSON.parse(await zip.file('figures/scratch_figure_1.figure.json').async('string'));
  assert.deepEqual(figure.plot.data[0].y, [25, 34, 42, 49, 55, 60, 64, 67, 69, 71, 72, 73, 74]);
  assert.equal(figure.plot.layout.annotations.find(a => a.text === 'Configuration A').font.size, 9, 'Original font size is preserved');
  const pngBytes = await zip.file('figures/scratch_figure_1.png').async('nodebuffer');
  assert.equal(pngBytes.subarray(1, 4).toString(), 'PNG');
  console.log('PASS: saved figure reopening, individual/ZIP PNG rendering, and original saved data');

  // Isolate the alternate placement from the kernel's figure-reactivation race.
  await page.reload();
  await page.waitForFunction(() => [...document.querySelectorAll('span')].some(s => s.textContent === 'Ready'), null, { timeout: 90000 });
  await run(SCRIPT.replace("'northwest'", "'northeast'"));
  await checkPlot('Northeast legend');
  console.log('PASS: northeast legend placement');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
