const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const JSZip = require('../node_modules/jszip');

const BASE = process.argv[2] || 'http://127.0.0.1:4184/';
const SCRIPT = String.raw`clear;
clc;
voltage_V = [0.2; 2.2];
force_N = [0; 100];
A = [voltage_V, ones(2, 1)];
parameters = A\force_N;
gain_N_per_V = parameters(1);
offset_N = parameters(2);
test_voltage_V = 1.2;
estimated_force_N = gain_N_per_V * test_voltage_V + offset_N;
fprintf('Gain: %.3f N/V\n', gain_N_per_V);
fprintf('Offset: %.3f N\n', offset_N);
fprintf('At %.2f V: %.3f N\n', test_voltage_V, estimated_force_N);
reconstructed_force_N = A*parameters;
residual_N = reconstructed_force_N - force_N;
max_residual_N = norm(residual_N, Inf);
fprintf('Maximum absolute residual: %.3e N\n', max_residual_N);
assert(max_residual_N < 1e-10, 'Calibration residual is too large.');
voltage_grid_V = linspace(0.2, 2.2, 101);
force_grid_N = gain_N_per_V * voltage_grid_V + offset_N;
figure;
plot(voltage_grid_V, force_grid_N, '-', 'LineWidth', 2);
hold on;
plot(voltage_V, force_N, 'ks', 'MarkerSize', 8);
plot(test_voltage_V, estimated_force_N, 'rd', 'MarkerSize', 8);
hold off;
xlabel('Sensor voltage (V)');
ylabel('Force (N)');
title('Two-point load-sensor calibration');
legend('Calibration model', 'Reference points', 'Model estimate', 'Location', 'northwest');
grid on;`;

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    await page.addInitScript(() => {
      localStorage.setItem('engr183-persistence-ack', '1');
      localStorage.setItem('engr183-onboarding-seen', '1');
      window.legendMarkers = el => {
        const label = el.layout.annotations.find(a => a.text === 'Reference points');
        if (!label) return null;
        const traces = el.data.filter(t => t.xaxis === label.xref && t.yaxis === label.yref);
        const subplot = el.querySelector(`.subplot.${label.xref}${label.yref}`);
        return {
          markers: traces.filter(t => t.marker?.symbol !== 'none' && t.mode.includes('markers')),
          points: [...(subplot?.querySelectorAll('.point') || [])].map(p => ({
            path: p.getAttribute('d'), fill: getComputedStyle(p).fill,
            transform: p.getAttribute('transform'),
          })),
          // Single-point marker objects also have a zero-length line path.
          lineCount: [...(subplot?.querySelectorAll('.js-line') || [])].filter(p => p.getTotalLength() > 0).length,
        };
      };
    });
    await page.goto(BASE + '?unit=scratch');
    await page.waitForFunction(() => [...document.querySelectorAll('span')].some(s => s.textContent === 'Ready'), null, { timeout: 90000 });
    async function closeWindows() {
      while (await page.getByTitle('Close figure', { exact: true }).count()) {
        await page.getByTitle('Close figure', { exact: true }).last().click();
      }
    }
    async function run(code) {
      await closeWindows();
      await page.locator('.monaco-editor').click();
      await page.keyboard.press('Control+A');
      // A leading '[' in an insertText call can trigger Monaco's auto-pairing.
      await page.keyboard.insertText('% Legend marker regression\n' + code + '\n');
      await page.getByRole('button', { name: 'Run File', exact: true }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Run File' && !b.disabled), null, { timeout: 45000 });
      const output = (await page.locator('pre').allTextContents()).join('\n');
      if (/error:|Execution exception/i.test(output)) {
        console.error('Requested code:', code);
        console.error('Editor:', await page.locator('.monaco-editor .view-lines').innerText());
      }
      assert(!/error:|Execution exception/i.test(output), output);
      return output;
    }
    const plot = page.locator('.js-plotly-plot').first();
    async function checkMarkers(context, symbols = ['square', 'diamond'], lines = 1) {
      await page.waitForFunction(symbols => {
        const el = document.querySelector('.js-plotly-plot');
        if (!el?._fullLayout) return false;
        const result = window.legendMarkers(el);
        return result?.markers.length === symbols.length && result.points.length === symbols.length;
      }, symbols);
      const result = await plot.evaluate(el => window.legendMarkers(el));
      assert.deepEqual(result.markers.map(t => t.marker.symbol).sort(), [...symbols].sort(), context);
      assert.equal(result.lineCount, lines, context + ': line samples');
      for (const marker of result.markers) {
        assert.equal(marker.x.length, 1, context + ': one centered marker per entry');
        assert.equal(marker.y.length, 1);
      }
      assert.equal(await plot.locator('.legendtext').count(), 0, 'No duplicate native legend');
      return result;
    }
    const output = await run(SCRIPT);
    assert(output.includes('Gain: 50.000 N/V') && output.includes('At 1.20 V: 50.000 N'), output);
    const original = await checkMarkers('Calibration example');
    assert.deepEqual(original.markers.map(t => t.marker.size), [8, 8]);
    assert.deepEqual(original.points.map(p => p.fill).sort(), ['rgb(0, 0, 0)', 'rgb(255, 0, 0)']);
    assert.notEqual(original.points[0].path, original.points[1].path, 'Square and diamond must have distinct shapes');
    await plot.screenshot({ path: 't141-legend-markers.png' });
    console.log('PASS: exact calibration example renders black square and red diamond legend samples');

    // Check the same data after persistence and through the actual PNG renderer.
    const saved = page.locator('section[aria-label="Saved figures"]');
    await closeWindows();
    await saved.locator('button[title^="Open "]').first().click();
    await checkMarkers('Reopened figure');
    await page.evaluate(() => {
      window.exportMarkers = null;
      new MutationObserver(() => {
        for (const el of document.querySelectorAll('[aria-hidden="true"].js-plotly-plot')) {
          if (!el._fullLayout) continue;
          const result = window.legendMarkers(el);
          if (result?.points.length === 2) window.exportMarkers = result;
        }
      }).observe(document.body, { childList: true, subtree: true });
    });
    const [png] = await Promise.all([
      page.waitForEvent('download'), saved.getByRole('button', { name: 'PNG', exact: true }).click(),
    ]);
    await png.saveAs('t141-legend-markers-export.png');
    assert.deepEqual((await page.evaluate(() => window.exportMarkers)).points, original.points, 'PNG renderer preserves marker shapes, colors and positions');
    const [download] = await Promise.all([
      page.waitForEvent('download'), page.getByRole('button', { name: 'Download All (.zip)', exact: true }).click(),
    ]);
    const zip = await JSZip.loadAsync(fs.readFileSync(await download.path()));
    const figure = JSON.parse(await zip.file('figures/scratch_figure_1.figure.json').async('string'));
    const label = figure.plot.layout.annotations.find(a => a.text === 'Reference points');
    assert.deepEqual(figure.plot.data.filter(t => t.xaxis === label.xref && t.mode.includes('markers')).map(t => t.marker.symbol), ['square', 'diamond']);
    const pngBytes = await zip.file('figures/scratch_figure_1.png').async('nodebuffer');
    assert.equal(pngBytes.subarray(1, 4).toString(), 'PNG');
    console.log('PASS: saved figure reopening, individual PNG, and ZIP exports preserve legend markers');

    // Explicit handles avoid the kernel's current-figure reset between requests.
    await run("a = get(1, 'currentaxes'); h = flipud(get(a, 'children')); set(h(2), 'marker', 'o', 'markersize', 5, 'color', [0 0.5 0]); set(h(3), 'linestyle', '--');");
    const updated = await checkMarkers('Property updates', ['circle', 'diamond'], 2);
    const circle = updated.markers.find(t => t.marker.symbol === 'circle');
    assert.equal(circle.marker.size, 5);
    assert.equal(circle.marker.color, 'rgb(0,127,0)');
    console.log('PASS: live marker size/color/shape and line-style updates');

    await run("[lg, icons, peers, labels] = legend(a, h([3 2 1]), {'Model estimate', 'Reference points', 'Calibration model'}, 'Location', 'northeast', 'Orientation', 'horizontal'); assert(numel(icons) == 6); assert(! any(isprop(icons, 'markertruesize'))); assert(numel(peers) == 3); assert(numel(labels) == 3);");
    await checkMarkers('Reordered and moved horizontal legend', ['diamond', 'circle'], 2);
    console.log('PASS: legend reuse, reordered entries, horizontal layout, location, and returned handles');

    await run("set(h(3), 'marker', 'none');");
    await checkMarkers('Removed marker', ['circle'], 2);
    await run("set(h(3), 'marker', 'd');");
    await checkMarkers('Restored marker', ['circle', 'diamond'], 2);
    console.log('PASS: marker removal and restoration');

    await run("legend(a, 'off'); legend(a, h, {'Calibration model', 'Reference points', 'Model estimate'}, 'Location', 'northwest');");
    await checkMarkers('Legend recreation', ['circle', 'diamond'], 2);
    await run('close all;\n' + SCRIPT);
    await checkMarkers('Repeated calibration');
    console.log('PASS: legend off/recreation and repeated calibration without cleanup errors');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
