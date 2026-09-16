const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:4186/';
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
    await page.addInitScript(() => {
      localStorage.setItem('engr183-persistence-ack', '1');
      localStorage.setItem('engr183-onboarding-seen', '1');
    });
    await page.goto(`${base}?unit=scratch`);
    await page.getByPlaceholder(/Type an Octave command/).waitFor({ timeout: 60000 });
    const code = `close all; figure; ax1 = subplot(2,1,1); h1 = plot([0 1],[2 3],'-o'); hold on; h2 = plot([0 1],[4 5],'--s'); lg = legend([h2 h1],{'Battery B','Battery A'}); title('Top'); xlabel('Time (min)'); ylabel('Voltage (V)'); grid on; ax2 = subplot(2,1,2); plot([0 1],[2 3],'-d'); title('Bottom'); assert(getpixelposition(ax1)(2)>getpixelposition(ax2)(2)); assert(isequal(getappdata(lg,'__peer_objects__')(:),[h2;h1])); assert(isequal(get(lg,'string')(:),{'Battery B';'Battery A'})); assert(isequal(get(h1,'xdata'),[0 1])); assert(isequal(get(h1,'ydata'),[2 3])); assert(strcmp(get(h1,'linestyle'),'-')); assert(strcmp(get(h2,'marker'),'s')); assert(strcmp(get(ax1,'xgrid'),'on') && strcmp(get(ax1,'ygrid'),'on')); assert(strcmp(get(get(ax1,'title'),'string'),'Top')); assert(strcmp(get(get(ax1,'ylabel'),'string'),'Voltage (V)')); assert(numel(get(ax1,'xlim'))==2 && numel(get(ax1,'ylim'))==2); disp('PROBE_DONE: positions, data, styles, grids, text, limits, and explicit legend association');`;
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(code);
    await page.getByRole('button', { name: 'Run File', exact: true }).click();
    await page.getByPlaceholder(/Type an Octave command/).waitFor({ timeout: 60000 });
    const output = await page.locator('pre').allTextContents();
    fs.writeFileSync('u06-probe-output.txt', output.join('\n'));
    console.log(output.join('\n'));
    assert.ok(output.join('\n').includes('PROBE_DONE:'), output.join('\n'));
    assert.equal(await page.locator('.js-plotly-plot').count(), 1);
    await page.screenshot({ path: 'u06-probe.png' });
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
