// Focused Unit 6 verification. No all-figures smoke harness or app test hooks.
// Usage: node u06-assignments.js gp|apa [http://127.0.0.1:4186/]
// Each invocation starts with a new browser profile. Evidence stays local.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const kind = process.argv[2] || 'gp';
const base = process.argv[3] || 'http://127.0.0.1:4186/';
const mode = process.env.U06_BROWSER_MODE || 'sequence';
const caseFilter = process.env.U06_CASE_FILTER ? new RegExp(process.env.U06_CASE_FILTER) : null;
const root = path.resolve(__dirname, '../../engr183-harness');
const c = JSON.parse(fs.readFileSync(path.join(root, '_verify/u06-cases.json')))[kind];
const source = state => fs.readFileSync(path.join(root, state, c.id, c.file), 'utf8');
const starter = source('_verify/unsolved');
const solved = source('_verify/solved');
const keys = kind === 'gp'
  ? ['personalization','execution','data','difference','arrangement','top','bottom','labels','identification','limits']
  : ['personalization','execution','data','power','output','arrangement','top','bottom','presentation','limits'];
const evidence = [];
const evidenceStem = `u06-${kind}-${mode}${caseFilter ? '-filtered' : ''}`;
const exportName = kind === 'gp' ? 'GP06_cooling_comparison.png' : 'APA06_battery_comparison.png';
const unindent = text => text.split('\n').map(line => line.trimStart()).join('\n');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, acceptDownloads: true });
  const pageErrors = [];
  let completed = false;
  let failure = null;
  page.on('pageerror', e => pageErrors.push(e.message));
  async function ready() {
    await page.getByPlaceholder(/Type an Octave command/).waitFor({ timeout: 60000 });
  }
  async function output() { return (await page.locator('pre').allTextContents()).join('\n'); }
  async function clearOutput() { await page.getByTitle('Clear the console (same as typing clc)').click(); }
  async function command(code) {
    await ready();
    await clearOutput();
    const input = page.getByPlaceholder(/Type an Octave command/);
    await input.fill(code);
    await input.press('Enter');
    await ready();
    return output();
  }
  async function closeWindows() {
    for (const button of await page.getByTitle('Close figure', { exact: true }).all()) await button.click();
  }
  async function setFile(code) {
    await closeWindows();
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.insertText(code);
  }
  async function downloadSource(expectedName = c.file) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download File', exact: true }).click();
    const download = await pending;
    assert.equal(download.suggestedFilename(), expectedName);
    return fs.readFileSync(await download.path(), 'utf8');
  }
  async function runTests(label, failed = [], expectedScore) {
    await ready();
    await clearOutput();
    const start = Date.now();
    await page.getByRole('button', { name: 'Run Tests', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('pre')].some(p => p.textContent.includes('Score:')), null, { timeout: 60000 });
    await ready();
    const text = await output();
    const elapsed = (Date.now()-start)/1000;
    const lines = text.split('\n').filter(line => /^\[ (PASS|FAIL) \]/.test(line));
    assert.equal(lines.length, 10, text);
    for (const key of failed) assert.match(lines[keys.indexOf(key)], /FAIL/, `${label}: ${key}\n${text}`);
    if (expectedScore !== undefined) assert.ok(text.includes(`Score: ${expectedScore}/10`), text);
    assert.ok(text.includes('code-check feedback') && text.includes('not the final Canvas grade'), text);
    if (label.endsWith('runtime error')) {
      assert.ok(text.includes('intentional Unit 6 error') && text.includes(c.file) && /line \d+/.test(text), text);
    }
    evidence.push({ label, elapsed, score: text.match(/Score: [^\n]+/)[0], report: text });
    console.log(`PASS ${kind} | ${label} | ${text.match(/Score: \d+\/10/)[0]} | ${elapsed.toFixed(3)} s`);
    return text;
  }
  try {
    await page.addInitScript(() => {
      localStorage.setItem('engr183-persistence-ack', '1');
      localStorage.setItem('engr183-onboarding-seen', '1');
    });
    await page.goto(`${base}?unit=${c.id}`);
    await ready();
    assert.equal(await downloadSource(), starter, 'Direct link must preload the exact starter');
    assert.equal(await page.locator('li span.flex-1.truncate').count(), 1);
    await runTests('untouched starter', [], 2);
    // Check the mounted checker itself, not just the newly served metadata.
    const checkerHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'tests/u06_plot_check.m'))).digest('hex');
    const mounted = await command(`disp(which('${c.id.replaceAll('-', '_')}_tests')); disp(['U06_CHECKER_SHA=' hash('sha256', fileread('/engr183/tests/u06_plot_check.m'))]);`);
    assert.ok(mounted.includes('/engr183/tests/') && mounted.includes(`U06_CHECKER_SHA=${checkerHash}`), mounted);
    console.log(`PASS ${kind} | new Unit 6 checker is mounted`);
    await setFile(solved);
    await clearOutput();
    const start = Date.now();
    await page.getByRole('button', { name: 'Run File', exact: true }).click();
    await ready();
    await page.waitForFunction(() => [...document.querySelectorAll('.js-plotly-plot')].some(p => p.querySelector('.main-svg') && p.data?.length), null, { timeout: 60000 });
    assert.equal(await page.locator('.js-plotly-plot').count(), 1);
    const plot = page.locator('.js-plotly-plot');
    const texts = await plot.locator('svg text').allTextContents();
    const joined = texts.join('\n');
    for (const title of (kind === 'gp'
      ? ['Cooling-system temperature comparison', 'Temperature difference between configurations', 'Time (min)', 'Temperature (C)', 'A - B temperature (C)']
      : ['Battery discharge voltage at constant load', 'Electrical power during battery discharge', 'Time (min)', 'Voltage (V)', 'Electrical power (W)'])) assert.ok(joined.includes(title), joined);
    console.log(`PASS ${kind} | rendered titles and labels`);
    const [png] = await Promise.all([
      page.waitForEvent('download'),
      plot.locator('[data-title*="Download plot"]').click(),
    ]);
    await png.saveAs(path.join(__dirname, exportName));
    const bytes = fs.readFileSync(path.join(__dirname, exportName));
    assert.equal(bytes.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
    assert.ok(bytes.readUInt32BE(16) >= 500 && bytes.readUInt32BE(20) >= 350);
    await page.screenshot({ path: path.join(__dirname, `u06-${kind}-solved.png`) });
    console.log(`PASS ${kind} | Run File, two rendered panels, camera PNG ${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)} | ${((Date.now()-start)/1000).toFixed(3)} s`);
    await closeWindows();
    const savedSource = await downloadSource();
    assert.equal(unindent(savedSource), unindent(solved));
    await page.reload();
    await ready();
    assert.equal(await downloadSource(), savedSource, 'Saved edits survive normal reload');
    // Test the complete reset interaction before the graphics regressions.
    await page.getByRole('button', { name: 'Reset File', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(await downloadSource(), savedSource);
    await page.getByTitle('Add a new file').click();
    await page.getByPlaceholder('newFile.m').fill('unit6_notes.m');
    await page.keyboard.press('Enter');
    await setFile('% Saved independently of the assignment starter.\n');
    await page.locator('li', { hasText: c.file }).click();
    await page.getByRole('button', { name: 'Reset File', exact: true }).click();
    await page.getByRole('button', { name: 'Reset file', exact: true }).click();
    assert.equal(await downloadSource(), starter);
    assert.equal(await page.locator('li', { hasText: 'unit6_notes.m' }).count(), 1);
    await page.locator('li', { hasText: 'unit6_notes.m' }).click();
    assert.equal((await downloadSource('unit6_notes.m')).trim(), '% Saved independently of the assignment starter.');
    await page.locator('li', { hasText: c.file }).click();
    console.log(`PASS ${kind} | reload persistence, canceled reset, confirmed reset, other file preserved`);
    await page.getByRole('button', { name: /All units/ }).click();
    await page.getByRole('button', { name: kind === 'gp' ? /Unit 6.*APA-06/ : /Unit 6.*GP-06/ }).click();
    await ready();
    await runTests('other unit starter after switch', [], 2);
    await page.getByRole('button', { name: /All units/ }).click();
    await page.getByRole('button', { name: kind === 'gp' ? /Unit 6.*GP-06/ : /Unit 6.*APA-06/ }).click();
    await ready();
    assert.equal(await downloadSource(), starter);
    assert.equal(await page.locator('li', { hasText: 'unit6_notes.m' }).count(), 1);
    await runTests('return to reset starter', [], 2);
    console.log(`PASS ${kind} | unit switches use fresh tests and preserve saved files`);
    // Every fixture increments a root appdata counter, which survives clear.
    await command("setappdata(0,'u06_verify_runs',0);");
    let executions = 0;
    for (const test of c.cases.filter(test => !caseFilter || caseFilter.test(test.name))) {
      if (mode === 'isolated') {
        // Diagnostic mode is explicitly distinct from consecutive-run proof.
        // It can establish grading coverage despite a kernel lifecycle fault.
        await page.reload();
        await ready();
        await command("setappdata(0,'u06_verify_runs',0);");
        executions = 0;
      }
      let code = solved;
      for (const [from,to] of test.replace) {
        assert.ok(code.includes(from), `Unmatched mutation ${test.name}: ${from}`);
        code = code.replaceAll(from,to);
      }
      code = `setappdata(0,'u06_verify_runs',getappdata(0,'u06_verify_runs')+1);\n${code}\n${test.append}\n`;
      await setFile(code);
      try {
        await runTests(mode === 'isolated' ? `isolated: ${test.name}` : test.name, test.fail, test.fail.length ? undefined : 10);
        const count = await command("fprintf('EXECUTIONS=%d\\n',getappdata(0,'u06_verify_runs'));");
        assert.ok(count.includes(`EXECUTIONS=${++executions}`), count);
        evidence[evidence.length-1].studentExecutions = 1;
      } catch (error) {
        evidence.push({ label: test.name, error: error.message, report: await output() });
        if (mode !== 'isolated') throw error;
        console.error(`FAIL ${kind} | isolated: ${test.name} | ${error.message}`);
        process.exitCode = 1;
      }
    }
    // Monaco may cancel an outstanding editor operation when its page/unit
    // is disposed. Keep that diagnostic; fail on all other page errors.
    assert.deepEqual(pageErrors.filter(message => message !== 'Canceled'), []);
    if (pageErrors.length) console.log(`NOTE ${kind} | ${pageErrors.length} canceled editor operation(s) during navigation`);
    completed = true;
  } catch (error) {
    failure = error.message;
    throw error;
  } finally {
    fs.writeFileSync(path.join(__dirname, `${evidenceStem}-last-output.txt`), await output());
    await page.screenshot({ path: path.join(__dirname, `${evidenceStem}-last.png`) });
    fs.writeFileSync(path.join(__dirname, `${evidenceStem}-results.json`), JSON.stringify({ base, mode, caseFilter: caseFilter?.source, completed, failure, evidence, pageErrors }, null, 2));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
