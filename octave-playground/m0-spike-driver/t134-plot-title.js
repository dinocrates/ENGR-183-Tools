const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const TITLE = 'Configuration A under the assumed heat load';
const SCRIPT = `
clear;
clc;
close all;
time_min = 0:12;
temp_A_C = [25 34 42 49 55 60 64 67 69 71 72 73 74];
figure;
plot(time_min, temp_A_C, '-o', 'LineWidth', 2);
xlabel('Time (min)');
ylabel('Temperature (C)');
title('${TITLE}');
grid on;
disp('title example complete');
`;

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
    page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
    await page.addInitScript(() => {
      localStorage.setItem('engr183-persistence-ack', '1');
      localStorage.setItem('engr183-onboarding-seen', '1');
    });
    await page.goto((process.argv[2] || 'http://127.0.0.1:5173/') + '?unit=scratch');
    await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 45000 }).catch(async e => { console.log(await page.locator('body').innerText()); throw e; });
    await page.click('.monaco-editor');
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(SCRIPT);
    await page.getByText('Run File', { exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('pre')].some(el => el.textContent.includes('title example complete')), null, { timeout: 30000 }).catch(async e => { console.log(await page.locator('body').innerText()); throw e; });
    await page.waitForFunction(() => document.querySelector('.js-plotly-plot')?._fullLayout, null, { timeout: 60000 });
    const plot = page.locator('.js-plotly-plot').first();
    await page.waitForFunction(title => [...document.querySelectorAll('.annotation-text')].some(el => el.textContent === title), TITLE);
    await plot.screenshot({ path: 't134-plot-title.png' });
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      plot.locator('[data-title*="Download"]').click(),
    ]);
    await download.saveAs('t134-plot-title-export.png');
    assert((await plot.locator('text').allTextContents()).includes(TITLE), 'the Octave title is rendered');
    const titleBox = await plot.locator('.annotation-text').boundingBox();
    const plotBox = await plot.boundingBox();
    assert(titleBox.y >= plotBox.y && titleBox.y + titleBox.height <= plotBox.y + plotBox.height, 'title is inside the exported canvas');
    const texts = await plot.locator('text').allTextContents();
    assert(texts.includes('Time (min)') && texts.includes('Temperature (C)'), 'axis labels remain visible');
    console.log('PASS: original example, axis labels, and title canvas bounds');

    let commandId = 0;
    async function command(code) {
      const marker = `title-check-${++commandId}`;
      const input = page.getByPlaceholder(/Type an Octave command|Continue the block/);
      await input.fill(`${code}; disp('${marker}');`);
      await input.press('Enter');
      await page.waitForFunction(marker => [...document.querySelectorAll('pre')].some(el => el.textContent.includes(marker)), marker, { timeout: 30000 });
      await page.waitForFunction(() => document.body.innerText.includes('Ready'), null, { timeout: 30000 });
    }
    async function expectTitles(expected) {
      await page.waitForFunction(expected => {
        const texts = [...document.querySelectorAll('.annotation-text')].map(el => el.textContent);
        return expected.every(t => texts.includes(t));
      }, expected);
    }
    // xeus-octave clears the current figure between requests; use explicit
    // axes handles when updating the figure created by the original script.
    await command("a = get(1, 'currentaxes'); h = title(a, 'Updated title', 'FontSize', 18, 'Color', [1 0 0]); assert(h == get(a, 'title'))");
    await expectTitles(['Updated title']);
    const style = await plot.locator('.annotation-text').evaluate(el => ({ size: getComputedStyle(el).fontSize, color: getComputedStyle(el).fill }));
    assert.equal(style.size, '18px');
    assert.equal(style.color, 'rgb(255, 0, 0)');
    await command("set(h, 'string', 'Updated through handle')");
    await expectTitles(['Updated through handle']);
    await command("title(a, '')");
    await page.waitForFunction(() => document.querySelectorAll('.annotation-text').length === 0);
    console.log('PASS: title replacement, returned handle, styling, handle updates, and title removal');

    await command("clf(1); a1 = subplot(1,2,1, 'parent', 1); plot(a1, 1:3); a2 = subplot(1,2,2, 'parent', 1); plot(a2, 3:-1:1); title(a1, 'Left title'); title(a2, 'Right title'); legend(a2, 'Cooling')");
    await expectTitles(['Left title', 'Right title', 'Cooling']);
    await command("title(a1, 'Replacement left')");
    await expectTitles(['Replacement left', 'Right title', 'Cooling']);
    assert(!(await plot.locator('.annotation-text').allTextContents()).includes('Left title'));
    console.log('PASS: subplot targeting and legend preservation');

    const figuresBefore = await page.locator('.js-plotly-plot').count();
    await command("f2 = figure; plot(1:3); title('Second figure')");
    await expectTitles(['Replacement left', 'Right title', 'Second figure']);
    assert.equal(await page.locator('.js-plotly-plot').count(), figuresBefore + 1);
    await command("plot(get(f2, 'currentaxes'), 3:-1:1)");
    await page.waitForFunction(() => ![...document.querySelectorAll('.annotation-text')].some(el => el.textContent === 'Second figure'));
    console.log('PASS: separate figures and clearing the title with a new plot');
    await command("title(get(f2, 'currentaxes'), {'Line one'; 'Literal <text> & \"quote\"'}, 'Interpreter', 'none')");
    await page.waitForFunction(() => [...document.querySelectorAll('.annotation-text')].some(el => el.textContent.includes('Literal <text> & "quote"')));
    await command("close(f2); clear all; f3 = figure; plot(1:3); title('After clear all')");
    await expectTitles(['After clear all']);
    console.log('PASS: multiline/literal text and wrapper survives clear all');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
