// Unit 7 acceptance: real editor, Run File/Tests, downloads and camera.
// node u07-assignments.js gp|apa [http://127.0.0.1:4187/]
// U07_BROWSER_MODE=mutations runs shared cases, optionally U07_CASE_FILTER.
// Evidence stays local; a printed score without returning Ready is a failure.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const kind = process.argv[2] || 'gp';
const base = process.argv[3] || 'http://127.0.0.1:4187/';
const mode = process.env.U07_BROWSER_MODE || 'workflow';
const filter = process.env.U07_CASE_FILTER ? new RegExp(process.env.U07_CASE_FILTER) : null;
const root = path.resolve(__dirname, '../../engr183-harness');
const config = JSON.parse(fs.readFileSync(path.join(root, '_verify/u07-cases.json')));
const c = config[kind];
const helper = 'solve_checked_system.m';
const read = (state, unit, file) => fs.readFileSync(path.join(root, '_verify', state, unit.id, file), 'utf8');
const keys = ['personalization','execution','inputs','matrix','helper','baseline','residual','known','application','change','plot','output'];
const evidence = [];
const normalize = text => text.replaceAll('\r\n', '\n').split('\n').map(line => line.trimStart()).join('\n').trim();
const mutate = (source, pairs) => {
  source = source.replaceAll('\r\n', '\n');
  for (const [from, to] of pairs) {
    assert.ok(source.includes(from), `Unmatched mutation: ${from}`);
    source = source.replaceAll(from, to);
  }
  return source;
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, acceptDownloads: true });
  const pageErrors = [];
  const errorStacks = [];
  page.on('pageerror', e => { pageErrors.push(e.message); errorStacks.push(e.stack); });
  let completed = false, failure = null;
  const ready = () => page.getByPlaceholder(/Type an Octave command/).waitFor({ timeout: 60000 });
  const output = async () => (await page.locator('pre').allTextContents()).join('\n');
  const clearOutput = () => page.getByTitle('Clear the console (same as typing clc)').click();
  async function command(code) {
    await ready(); await clearOutput();
    const input = page.getByPlaceholder(/Type an Octave command/);
    await input.fill(code); await input.press('Enter'); await ready();
    return output();
  }
  async function closeFigures() {
    for (const b of await page.getByTitle('Close figure', { exact: true }).all()) await b.click();
  }
  async function openFile(file) {
    await closeFigures(); await page.locator('li', { hasText: file }).click();
  }
  async function setFile(file, code) {
    await openFile(file); await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+A'); await page.keyboard.insertText(code);
  }
  async function download(file) {
    await openFile(file);
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download File', exact: true }).click();
    const item = await pending;
    assert.equal(item.suggestedFilename(), file);
    return fs.readFileSync(await item.path(), 'utf8');
  }
  async function runTests(label, score, failures = []) {
    await ready(); await clearOutput(); const start = Date.now();
    await page.getByRole('button', { name: 'Run Tests', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('pre')].some(p => p.textContent.includes('Score:')), null, { timeout: 60000 });
    await ready();
    const report = await output();
    const lines = report.split('\n').filter(line => /^\[ (PASS|FAIL) \]/.test(line));
    assert.equal(lines.length, 12, report);
    if (score !== undefined) assert.ok(report.includes(`Score: ${score}/12`), report);
    for (const key of failures) assert.match(lines[keys.indexOf(key)], /FAIL/, `${label}: ${key}\n${report}`);
    assert.ok(report.includes('not the final Canvas grade'), report);
    const seconds = (Date.now() - start) / 1000;
    evidence.push({ label, report, seconds });
    console.log(`PASS ${kind} | ${label} | ${report.match(/Score: \d+\/12/)[0]} | ${seconds.toFixed(3)} s`);
  }
  async function switchUnit(unit) {
    await closeFigures(); await page.getByRole('button', { name: /All units/ }).click();
    await page.getByRole('button', { name: unit.id.includes('gp07') ? /Unit 7.*GP-07/ : /Unit 7.*APA-07/ }).click();
    await ready();
  }
  try {
    await page.addInitScript(() => {
      localStorage.setItem('engr183-persistence-ack', '1');
      localStorage.setItem('engr183-onboarding-seen', '1');
    });
    await page.goto(`${base}?unit=${c.id}`); await ready();
    assert.equal(await download(c.file), read('unsolved', c, c.file));
    assert.equal(await download(helper), read('unsolved', c, helper));
    assert.equal(await page.locator('li span.flex-1.truncate').count(), 2);
    await openFile(c.file);
    await runTests('untouched starter', c.starterScore);
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'tests/u07_system_check.m'))).digest('hex');
    const mounted = await command(`disp(which('${c.id.replaceAll('-', '_')}_tests')); disp(['U07_CHECKER_SHA=' hash('sha256', fileread('/engr183/tests/u07_system_check.m'))]); disp(fileread('/engr183/HARNESS_VERSION'));`);
    assert.ok(mounted.includes('/engr183/tests/') && mounted.includes(`U07_CHECKER_SHA=${hash}`), mounted);
    evidence.push({ label: 'mounted checker and harness version', hash, output: mounted });
    console.log(`PASS ${kind} | mounted checker matches source ${hash}`);

    if (mode === 'workflow') {
      // Independent per-project helper copies and same-session starter path.
      const other = config[kind === 'gp' ? 'apa' : 'gp'];
      await switchUnit(other);
      assert.equal(await download(helper), read('unsolved', other, helper));
      await runTests('other project starter', other.starterScore);
      await switchUnit(c);
      assert.equal(await download(helper), read('unsolved', c, helper));
      await runTests('return to original starter', c.starterScore);

      await setFile(helper, read('solved', c, helper));
      await setFile(c.file, read('solved', c, c.file));
      await clearOutput();
      await page.getByRole('button', { name: 'Run File', exact: true }).click();
      await ready();
      await page.waitForFunction(() => [...document.querySelectorAll('.js-plotly-plot')].some(p => p.querySelector('.main-svg') && p.data?.length), null, { timeout: 60000 });
      assert.equal(await page.locator('.js-plotly-plot').count(), 1);
      const plot = page.locator('.js-plotly-plot');
      const labels = (await plot.locator('svg text').allTextContents()).join('\n');
      for (const label of kind === 'gp'
        ? ['Resistor network node voltages','Node number','Node voltage (V)','Original supply (12 V)','Changed supply (10.8 V)']
        : ['Recovered force components','Force component','Force (N)','Fx','Fy','Fz','Original readings','Changed readings']) assert.ok(labels.includes(label), labels);
      const [png] = await Promise.all([page.waitForEvent('download'), plot.locator('[data-title*="Download plot"]').click()]);
      const exportName = kind === 'gp' ? 'GP07_node_voltages.png' : 'APA07_force_comparison.png';
      await png.saveAs(path.join(__dirname, exportName));
      const bytes = fs.readFileSync(path.join(__dirname, exportName));
      assert.equal(bytes.subarray(0,8).toString('hex'), '89504e470d0a1a0a');
      evidence.push({ label: 'actual camera export', file: exportName, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), labels });
      await page.screenshot({ path: path.join(__dirname, `u07-${kind}-solved.png`) });
      console.log(`PASS ${kind} | Run File, rendered labels and camera export`);
      const saved = {};
      for (const file of [c.file, helper]) {
        saved[file] = await download(file);
        assert.equal(normalize(saved[file]), normalize(read('solved', c, file)));
      }
      await page.reload(); await ready();
      for (const file of [c.file, helper]) assert.equal(await download(file), saved[file]);
      evidence.push({ label: 'returning deep link preserves both downloads' });
      await runTests('complete reference after reload', 12);
      // Editor changes exercise invalidation without manually clearing functions.
      await setFile(helper, read('solved', c, helper).replace('x = A\\b;', 'x = [1;2;3];'));
      await runTests('edited failing helper', undefined, ['helper']);
      await setFile(helper, read('solved', c, helper));
      await runTests('corrected helper', 12);
      await setFile(c.file, `${read('solved',c,c.file)}\nerror('intentional Unit 7 error');\n`);
      await runTests('runtime error', undefined, ['execution']);
      await setFile(c.file, read('solved',c,c.file));
      await runTests('corrected main script', 12);
      await openFile(c.file);
      await page.getByRole('button', { name: 'Reset File', exact: true }).click();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      assert.equal(normalize(await download(c.file)), normalize(saved[c.file]));
      await page.getByRole('button', { name: 'Reset File', exact: true }).click();
      await page.getByRole('button', { name: 'Reset file', exact: true }).click();
      assert.equal(await download(c.file), read('unsolved',c,c.file));
      assert.equal(normalize(await download(helper)), normalize(saved[helper]));
      await runTests('main reset preserves completed helper', 3);
      evidence.push({ label: 'canceled/confirmed reset preserves other source' });
    } else {
      await command("setappdata(0,'u07_verify_runs',0);"); let count = 0;
      for (const test of c.cases.filter(t => !filter || filter.test(t.name))) {
        const code = `setappdata(0,'u07_verify_runs',getappdata(0,'u07_verify_runs')+1);\n${mutate(read('solved',c,c.file),test.replace)}\n${test.append}\n`;
        await setFile(helper, mutate(read('solved',c,helper),test.helper));
        await setFile(c.file, code);
        await runTests(test.name, test.fail.length ? undefined : 12, test.fail);
        assert.ok((await command("fprintf('EXECUTIONS=%d\\n',getappdata(0,'u07_verify_runs'));" )).includes(`EXECUTIONS=${++count}`));
        evidence[evidence.length-1].studentExecutions = 1;
      }
      await setFile(helper,read('solved',c,helper)); await setFile(c.file,read('solved',c,c.file));
    }
    assert.deepEqual(pageErrors.filter(e => e !== 'Canceled'), []);
    completed = true;
  } catch (e) { failure = e.message; throw e; }
  finally {
    const stem = `u07-${kind}-${mode}${filter ? '-filtered' : ''}`;
    fs.writeFileSync(path.join(__dirname, `${stem}-last-output.txt`), await output());
    await page.screenshot({ path: path.join(__dirname, `${stem}-last.png`) });
    fs.writeFileSync(path.join(__dirname, `${stem}-results.json`), JSON.stringify({ base, mode, completed, failure, evidence, pageErrors, errorStacks },null,2));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
