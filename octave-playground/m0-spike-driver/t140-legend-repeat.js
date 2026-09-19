const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const BASE = process.argv[2] || 'http://127.0.0.1:4184/';
const SCRIPT = `clear;
clc;
close all;
data = readmatrix('cooling_test.csv');
time_min = data(:,1);
temp_A_C = data(:,2);
temp_B_C = data(:,3);
limit_C = 70;
figure;
plot(time_min, temp_A_C, '-o', 'LineWidth', 2);
hold on;
plot(time_min, temp_B_C, '--s', 'LineWidth', 2);
plot([0 12], [limit_C limit_C], 'k--', 'LineWidth', 1.5);
hold off;
xlabel('Time (min)');
ylabel('Temperature (C)');
title('Cooling Comparison at the same heat load');
legend('Configuration A', 'Configuration B', 'Design Limit', 'Location', 'northwest');
grid on;
xlim([0 12]);
ylim([20 85]);
[peak_A_C, idx_A] = max(temp_A_C);
text(time_min(idx_A)-4, peak_A_C+3, sprintf('Peak A: %0.f C', peak_A_C));
fprintf('Final Difference: %0.1f C\\n', temp_A_C(end)-temp_B_C(end));
assert(numel(findall(0, 'type', 'figure')) == 1);
assert(numel(findall(0, 'tag', 'legend')) == 1);
disp('cooling complete');`;

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
    await page.addInitScript(() => {
      localStorage.setItem('engr183-persistence-ack', '1');
      localStorage.setItem('engr183-onboarding-seen', '1');
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
      await page.keyboard.insertText(code);
      await page.getByRole('button', { name: 'Run File', exact: true }).click();
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent === 'Run File' && !b.disabled), null, { timeout: 30000 }).catch(async error => {
        console.error((await page.locator('pre').allTextContents()).join('\n'));
        throw error;
      });
      const output = (await page.locator('pre').allTextContents()).join('\n');
      assert(!/error:|Execution exception/i.test(output), output);
      return output;
    }
    // Deterministic sample readings; the reported CSV is not needed to trigger cleanup.
    const a = [25, 34, 42, 49, 55, 60, 64, 67, 69, 71, 72, 73, 74];
    const b = [25, 32, 37, 41, 44, 46, 47, 48, 49, 49, 50, 50, 50];
    const csv = a.map((value, index) => `${index},${value},${b[index]}\n`).join('');
    await page.setInputFiles('input[type=file]', { name: 'cooling_test.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
    await page.getByText('cooling_test.csv', { exact: true }).first().waitFor();
    await page.getByText('scratch.m', { exact: true }).first().click();
    for (let attempt = 1; attempt <= 3; attempt++) {
      const output = await run(SCRIPT);
      assert(output.includes('Final Difference: 24.0 C'), output);
      assert(output.includes('cooling complete'), output);
      await page.waitForFunction(() => ['Configuration A', 'Configuration B', 'Design Limit', 'Cooling Comparison at the same heat load'].every(label => [...document.querySelectorAll('.annotation-text')].some(t => t.textContent === label)));
      assert.equal(await page.locator('.js-plotly-plot').count(), 1);
      console.log(`PASS: cooling script run ${attempt} with title, legend, and no cleanup errors`);
    }
    // Keep creation and closing of multiple legends in separate executions.
    // Same-request teardown has an additional upstream issue (octave/README.md).
    const cases = [
      ['clear all', "clear all; close all; figure; plot(1:3); legend('After clear all');"],
      ['legend off and recreate', "a = get(1, 'currentaxes'); legend(a, 'off'); legend(a, 'Recreated');"],
      ['clf', "clf(1); a = axes('parent', 1); plot(a, 1:3); legend(a, 'After clf');"],
      ['multiple figures', "close all; for k = 1:3; figure; plot(1:3); legend('Multiple'); end; assert(numel(findall(0, 'type', 'figure')) == 3);"],
      ['closing multiple figures', "close all; assert(isempty(findall(0, 'type', 'figure')));"],
      ['custom deletion callback setup', "figure; plot(1:3); legend('Custom', 'DeleteFcn', @(h, e) setappdata(0, 'legend_deleted', true));"],
      ['custom deletion callback', "close all; assert(getappdata(0, 'legend_deleted'));"],
    ];
    for (const [name, code] of cases) {
      const output = await run(`${code}\ndisp('cleanup case complete');`);
      assert(output.includes('cleanup case complete'), output);
      console.log(`PASS: ${name}`);
    }
    // Stop creates a fresh kernel: compatibility code must be installed again.
    await closeWindows();
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText('while true; end;');
    await page.getByRole('button', { name: 'Run File', exact: true }).click();
    await page.getByRole('button', { name: 'Stop', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('span')].some(s => s.textContent === 'Ready'), null, { timeout: 90000 });
    for (let attempt = 1; attempt <= 2; attempt++) {
      const output = await run(SCRIPT);
      assert(output.includes('cooling complete'), output);
    }
    console.log('PASS: repeated cooling runs after Stop/restart');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
