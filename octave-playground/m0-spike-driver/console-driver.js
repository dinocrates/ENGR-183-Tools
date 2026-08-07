const { chromium } = require('playwright');

async function runCell(page, code) {
  const editor = page.locator('.cm-content').last();
  await editor.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
  const outputsBefore = await page.locator('.jp-OutputArea-output').count();
  await page.keyboard.press('Shift+Enter');
  await page.waitForFunction(
    (n) => document.querySelectorAll('.jp-OutputArea-output').length > n,
    outputsBefore,
    { timeout: 15000 }
  ).catch(() => {});
  await page.waitForTimeout(800);
  const outputs = await page.locator('.jp-OutputArea-output').allTextContents();
  return outputs.slice(outputsBefore).join('\n---\n');
}

module.exports = { runCell };

if (require.main === module) {
  (async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const pageLogs = [];
    page.on('console', (m) => pageLogs.push(`[${m.type()}] ${m.text()}`));

    await page.goto('http://localhost:8000/repl/index.html?kernel=xoctave&toolbar=1', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });
    await page.waitForTimeout(4000);

    const tests = {
      't0.2_arith_matrix_for': "a = 2 + 3\nb = [1 2 3] * 2\nfor i = 1:3\n  printf('%d ', i);\nend",
      't0.2_function_file_semantics_inline': "function y = sq(x)\n  y = x^2;\nend\nprintf('sq(4)=%d\\n', sq(4))",
      't0.2_printf_fprintf': "printf('printf works: %d\\n', 42)\nfprintf('fprintf works: %d\\n', 43)",
      't0.2_error_trycatch': "try\n  error('boom')\ncatch err\n  printf('caught: %s\\n', err.message)\nend",
      't0.3_version': 'version()',
      't0.5_evalc': "s = evalc('disp(123)')",
      't0.7_plot': "plot([1 2 3], [4 5 6]); xlabel('x'); title('m0 plot test');",
    };

    const results = {};
    for (const [name, code] of Object.entries(tests)) {
      try {
        results[name] = await runCell(page, code);
      } catch (e) {
        results[name] = 'EXCEPTION: ' + String(e);
      }
    }

    console.log('RESULTS:\n' + JSON.stringify(results, null, 2));
    await page.screenshot({ path: 'console-after-tests.png', fullPage: true });
    console.log('\n--- last 20 page console logs ---');
    console.log(pageLogs.slice(-20).join('\n'));

    await browser.close();
  })().catch((e) => {
    console.error('FATAL', e);
    process.exit(1);
  });
}
