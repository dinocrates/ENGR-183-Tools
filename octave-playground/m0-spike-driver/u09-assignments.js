// Local browser acceptance; instructor fixtures never enter served assets.
// node u09-assignments.js [base] [gp|apa|workflow|probe]
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const base = process.argv[2] || 'http://127.0.0.1:4189/';
const mode = process.argv[3] || 'workflow';
const root = path.resolve(__dirname, '../../engr183-harness');
const projects = {
  gp: { id: 'u09-gp09-cooling', file: 'U09_GP09_Cooling.m', png: ['GP09_fit_residuals.png', 'GP09_target.png'] },
  apa: { id: 'u09-apa09-pump', file: 'U09_APA09_Pump.m', png: ['APA09_fit_residuals.png', 'APA09_operating_point.png'] },
};
const read = (state, p) => fs.readFileSync(path.join(root, '_verify', state, p.id, p.file), 'utf8');
const normalize = t => t.replaceAll('\r\n', '\n').split('\n').map(x => x.trimStart()).join('\n').trim();
const evidence = [];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, acceptDownloads: true });
  const errors = []; page.on('pageerror', e => { errors.push(e.message); console.error('PAGE ERROR', e.message); });
  const recoveredErrors = new Set();
  let failure;
  const output = async () => (await page.locator('pre').allTextContents()).join('\n');
  const ready = () => page.getByPlaceholder(/Type an Octave command/).waitFor({ timeout: 90000 });
  const clearOutput = () => page.getByTitle('Clear the console (same as typing clc)').click();
  async function closeFigures() {
    const b = page.getByTitle('Close figure', { exact: true });
    while (await b.count()) await b.last().click();
  }
  async function command(code) {
    await ready(); await clearOutput();
    const box = page.getByPlaceholder(/Type an Octave command/);
    await box.fill(code); await box.press('Enter'); await ready(); return output();
  }
  async function open(p) {
    await closeFigures();
    if (await page.getByRole('button', { name: /All units/ }).count()) {
      await page.getByRole('button', { name: /All units/ }).click();
      await page.getByRole('button', { name: p.id.includes('gp09') ? /GP-09: Cooling Data Explorer/ : /APA-09: Pump Operating Point/ }).click();
    } else await page.goto(`${base}?unit=${p.id}`);
    await ready();
  }
  async function setFile(p, source) {
    await closeFigures();
    await page.locator('li').filter({ has: page.locator('span.flex-1.truncate', { hasText: p.file }) }).click();
    await page.locator('.monaco-editor').click(); await page.keyboard.press('Control+A'); await page.keyboard.insertText(source);
  }
  async function download(p) {
    await closeFigures(); const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download File', exact: true }).click();
    const d = await pending; assert.equal(d.suggestedFilename(), p.file);
    return fs.readFileSync(await d.path(), 'utf8');
  }
  async function tests(label, score, allowRecovery = process.env.U09_RECOVER === '1') {
    console.log('CHECK', label); await closeFigures(); await ready(); await clearOutput();
    const savedCount = await page.getByRole('region', { name: 'Saved figures' }).locator('li').count();
    const firstError = errors.length; let onError;
    const kernelError = new Promise((_, reject) => { onError = reject; page.on('pageerror', onError); });
    try {
    await page.getByRole('button', { name: 'Run Tests', exact: true }).click();
    await Promise.race([kernelError, page.waitForFunction(() => [...document.querySelectorAll('pre')].some(p => p.textContent.includes('Score:')), null, { timeout: 120000 })]);
    await ready(); const report = await output();
    assert.ok(report.includes(`Score: ${score}/12`), report);
    assert.ok(report.includes('instructor review') && report.includes('Run Tests never submits'), report);
    assert.equal(await page.getByRole('region', { name: 'Saved figures' }).locator('li').count(), savedCount, 'Run Tests preserves saved student figures');
    evidence.push({ label, report }); console.log('PASS', label, score);
    } catch (error) {
      const faults = errors.slice(firstError);
      if (!allowRecovery || !faults.length || !faults.every(e => /JSON|memory access out of bounds/.test(e))) throw error;
      page.off('pageerror', onError);
      evidence.push({ label: `${label}: vendor fault; Stop/retry`, faults });
      for (let i = firstError; i < errors.length; i++) recoveredErrors.add(i);
      await page.getByRole('button', { name: 'Stop', exact: true }).click(); await ready();
      await tests(`${label} after Stop`, score, false);
    } finally { page.off('pageerror', onError); }
  }
  async function exports(p) {
    await closeFigures(); const region = page.getByRole('region', { name: 'Saved figures' });
    assert.equal(await region.locator('li').count(), 2);
    for (let k = 0; k < 2; k++) {
      await region.getByTitle(/Open .*interactive saved figure/).nth(k).click();
      const plot = page.locator('.js-plotly-plot'); await plot.locator('.main-svg').first().waitFor();
      const labels = (await plot.locator('svg text').allTextContents()).join('\n');
      const filename = /residuals/i.test(labels) ? p.png[0] : p.png[1];
      const pending = page.waitForEvent('download'); await plot.locator('[data-title*="Download plot"]').click();
      const d = await pending; await d.saveAs(path.join(__dirname, filename));
      const bytes = fs.readFileSync(path.join(__dirname, filename));
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      if (filename === p.png[0]) {
        assert.equal(bytes.readUInt32BE(16), 1000, 'Respect the standard figure Position for readable four-panel exports');
        assert.equal(bytes.readUInt32BE(20), 700);
      }
      const traces = await plot.evaluate(p => p.data);
      evidence.push({ label: 'camera export (rename downloaded PNG for Canvas)', filename, suggested: d.suggestedFilename(), width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), labels, traces });
      await closeFigures();
    }
  }
  try {
    await page.addInitScript(() => {
      localStorage.setItem('engr183-persistence-ack', '1'); localStorage.setItem('engr183-onboarding-seen', '1');
    });
    if (mode === 'switch') {
      for (const kind of ['gp', 'apa']) {
        const p = projects[kind]; await open(p);
        assert.equal(normalize(await download(p)), normalize(read('unsolved', p)));
        await setFile(p, read('solved', p)); await tests(`${kind} before menu switch`, 12);
        await page.waitForTimeout(800);
      }
      await open(projects.gp);
      assert.equal(normalize(await download(projects.gp)), normalize(read('solved', projects.gp)));
      await tests('GP -> APA -> GP through assignment menu', 12);
      assert.deepEqual(errors.filter((x, i) => x !== 'Canceled' && !recoveredErrors.has(i)), []);
      return;
    }
    for (const kind of mode.startsWith('apa') ? ['apa'] : mode === 'gp' || mode === 'probe' ? ['gp'] : ['gp', 'apa']) {
      const p = projects[kind]; await open(p);
      assert.equal(normalize(await download(p)), normalize(read('unsolved', p)));
      if (mode !== 'apa-figures' && mode !== 'figures-checks') await tests(`${kind} untouched`, 2);
      const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'tests/u09_numeric_check.m'))).digest('hex');
      const probe = await command("disp(['CHECKER_SHA=' hash('sha256',fileread('/engr183/tests/u09_numeric_check.m'))]); disp(which('interp1')); disp(which('polyfit')); disp(which('polyval')); disp(which('fzero')); disp(isfinite(1));");
      assert.ok(probe.includes(hash), probe); evidence.push({ label: 'mounted checker/core routines', hash, probe });
      await setFile(p, read('solved', p)); await clearOutput();
      await page.getByRole('button', { name: 'Run File', exact: true }).click(); await ready();
      evidence.push({ label: `${kind} Run File`, output: await output() }); console.log(await output());
      if (mode === 'probe') break;
      await page.waitForFunction(() => document.querySelectorAll('.js-plotly-plot').length === 2, null, { timeout: 60000 });
      await exports(p);
      if (mode === 'apa-figures') break;
      await tests(`${kind} completed`, 12);
      if (mode === 'figures-checks') {
        assert.equal(await page.getByTitle('Close figure', { exact: true }).count(), 0, 'Hidden checking figures must not create empty viewer windows');
        assert.equal(await page.getByRole('region', { name: 'Saved figures' }).locator('li').count(), 2);
        await exports(p); // Saved plots still reopen and export after checking.
        evidence.push({ label: `${kind}: no checker windows; both saved figures preserved and exported again` });
        await page.waitForTimeout(800);
        continue;
      }
      assert.equal(normalize(await download(p)), normalize(read('solved', p)));
      // Actual saved edits, fresh snapshot, error location, then recovery.
      const broken = kind === 'gp' ? '\nT_queries = [40.5 47.5 58.5];\n' : '\nH35 = 32;\n';
      await setFile(p, read('solved', p) + broken); await tests(`${kind} edited result`, 11);
      await setFile(p, read('solved', p) + "\nerror('intentional Unit 9 error');\n"); await tests(`${kind} failed run`, 1);
      assert.ok((await output()).includes(p.file) && (await output()).includes('line'));
      await setFile(p, read('solved', p)); await tests(`${kind} corrected`, 12);
      await page.waitForTimeout(800); await page.reload(); await ready();
      assert.equal(normalize(await download(p)), normalize(read('solved', p)));
      await tests(`${kind} returning`, 12);
    }
    if (mode === 'workflow') {
      await open(projects.gp); assert.equal(normalize(await download(projects.gp)), normalize(read('solved', projects.gp)));
      await tests('GP -> APA -> GP saved work and fresh snapshot', 12);
    }
    assert.deepEqual(errors.filter((x, i) => x !== 'Canceled' && !recoveredErrors.has(i)), []);
  } catch (err) { failure = err.stack; throw err; }
  finally {
    fs.writeFileSync(path.join(__dirname, `u09-${mode}-output.txt`), await output());
    fs.writeFileSync(path.join(__dirname, `u09-${mode}-results.json`), JSON.stringify({ base, failure, errors, evidence }, null, 2));
    await page.screenshot({ path: path.join(__dirname, `u09-${mode}-last.png`) }); await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
