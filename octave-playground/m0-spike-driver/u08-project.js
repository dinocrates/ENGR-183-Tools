// Unit 8 acceptance against a local build with a freshly repacked harness mount.
// node u08-project.js [http://127.0.0.1:4188/]
// Strict by default. U08_RECOVER=1 additionally exercises one Stop/retry per
// check after a known vendor kernel fault, recording every fault in evidence.
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const JSZip = require('../node_modules/jszip');
const base = process.argv[2] || 'http://127.0.0.1:4188/';
const id = 'u08-project-solar-station';
const root = path.resolve(__dirname, '../../engr183-harness');
const files = ['SolarStation_Analysis.m', 'evaluate_system.m'];
const read = (state, file) => fs.readFileSync(path.join(root, '_verify', state, id, file), 'utf8');
const normalize = text => text.replaceAll('\r\n', '\n').split('\n').map(x => x.trimStart()).join('\n').trim();
const evidence = [];
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1500, height: 1100 }, acceptDownloads: true });
  const pageErrors = [];
  const recoveredErrors = new Set();
  page.on('pageerror', e => pageErrors.push(e.message));
  let failure = null;
  const ready = () => page.getByPlaceholder(/Type an Octave command/).waitFor({ timeout: 60000 });
  const output = async () => (await page.locator('pre').allTextContents()).join('\n');
  const clearOutput = () => page.getByTitle('Clear the console (same as typing clc)').click();
  async function command(code) {
    await ready(); await clearOutput();
    const box = page.getByPlaceholder(/Type an Octave command/);
    await box.fill(code); await box.press('Enter'); await ready(); return output();
  }
  async function closeFigures() {
    const buttons = page.getByTitle('Close figure', { exact: true });
    while (await buttons.count()) await buttons.last().click();
  }
  async function openFile(file) {
    await closeFigures(); await page.locator('li').filter({ has: page.locator('span.flex-1.truncate', { hasText: file }) }).click();
  }
  async function setFile(file, code) {
    await openFile(file); await page.locator('.monaco-editor').click();
    await page.keyboard.press('Control+A'); await page.keyboard.insertText(code);
  }
  async function download(file) {
    await openFile(file); const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download File', exact: true }).click();
    const item = await pending; assert.equal(item.suggestedFilename(), file);
    return fs.readFileSync(await item.path(), 'utf8');
  }
  async function runTests(label, score, allowRecovery = process.env.U08_RECOVER === '1') {
    console.log(`CHECK ${label}`);
    await closeFigures(); await ready(); await clearOutput(); const start = Date.now();
    const firstError = pageErrors.length;
    let onError;
    const kernelError = new Promise((_, reject) => { onError = reject; page.on('pageerror', onError); });
    try {
    await page.getByRole('button', { name: 'Run Tests', exact: true }).click();
    await Promise.race([kernelError, page.waitForFunction(() => [...document.querySelectorAll('pre')].some(p => p.textContent.includes('Score:')), null, { timeout: 120000 })]);
    await ready(); const report = await output();
    assert.ok(report.includes(`Score: ${score}/12`), report);
    assert.ok(report.includes('do not assess the written report'), report);
    evidence.push({ label, report, seconds: (Date.now() - start) / 1000 });
    console.log(`PASS ${label} | ${score}/12 | ${evidence.at(-1).seconds.toFixed(2)} s`);
    } catch (error) {
      const faults = pageErrors.slice(firstError);
      if (!allowRecovery || !faults.length || !faults.every(e => /JSON|memory access out of bounds/.test(e))) throw error;
      page.off('pageerror', onError);
      evidence.push({ label: `${label}: vendor fault; checking Stop/retry`, faults });
      console.warn(`KERNEL RECOVERY ${label}: ${faults.join('; ')}`);
      for (let i = firstError; i < pageErrors.length; i++) recoveredErrors.add(i);
      await page.getByRole('button', { name: 'Stop', exact: true }).click(); await ready();
      await runTests(`${label} after Stop`, score, false);
    } finally { page.off('pageerror', onError); }
  }
  try {
    await page.addInitScript(() => {
      localStorage.setItem('engr183-persistence-ack', '1');
      localStorage.setItem('engr183-onboarding-seen', '1');
    });
    await page.goto(base);
    await page.getByRole('button', { name: /Unit 8.*Solar-Panel/ }).click(); await ready();
    console.log('PASS Unit 8 discovery and startup');
    assert.ok(page.url().includes(`unit=${id}`));
    const guide = page.getByRole('link', { name: /Assignment guide:/ });
    const response = await page.request.get(new URL(await guide.getAttribute('href'), page.url()).href);
    assert.equal(response.status(), 200); assert.ok((await response.text()).includes('cost_per_avg_W'));
    for (const file of files) assert.equal(normalize(await download(file)), normalize(read('unsolved', file)));
    assert.ok(await page.getByText('solar_station_measurements.csv', { exact: true }).count());
    await openFile(files[0]); await clearOutput();
    await page.getByRole('button', { name: 'Run File', exact: true }).click(); await ready();
    assert.equal(await page.locator('.js-plotly-plot').count(), 0);
    evidence.push({ label: 'untouched main runs safely and creates no solved figures' });
    await runTests('untouched starter', 0);
    const checker = fs.readFileSync(path.join(root, 'tests/u08_project_solar_station_check.m'));
    const hash = crypto.createHash('sha256').update(checker).digest('hex');
    const probe = await command("disp(['CHECKER_SHA=' hash('sha256',fileread('/engr183/tests/u08_project_solar_station_check.m'))]); disp(['CSV_SHA=' hash('sha256',fileread('solar_station_measurements.csv'))]); raw=readmatrix('solar_station_measurements.csv'); fprintf('CSV_SIZE=%d,%d\\n',size(raw));");
    const csvHash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'assignments', id, 'solar_station_measurements.csv'))).digest('hex');
    assert.ok(probe.includes(`CHECKER_SHA=${hash}`) && probe.includes(`CSV_SHA=${csvHash}`) && probe.includes('CSV_SIZE=125,11'), probe);
    evidence.push({ label: 'route, three preloaded files, exact CSV and mounted checker', hash, csvHash });
    console.log('PASS exact CSV and mounted checker hashes');
    for (const file of files) await setFile(file, read('solved', file));
    await openFile(files[0]); await clearOutput();
    await page.getByRole('button', { name: 'Run File', exact: true }).click(); await ready();
    await page.waitForFunction(() => document.querySelectorAll('.js-plotly-plot').length === 2, null, { timeout: 60000 });
    assert.ok((await output()).includes('Recommended system: B'));
    console.log('PASS Run File: numerical results and two figures');
    await closeFigures();
    const savedRegion = page.getByRole('region', { name: 'Saved figures' });
    assert.equal(await savedRegion.locator('li').count(), 2);
    for (let k = 0; k < 2; k++) {
      await savedRegion.getByTitle(/Open .*interactive saved figure/).nth(k).click();
      const plot = page.locator('.js-plotly-plot');
      await plot.locator('.main-svg').first().waitFor();
      const labels = (await plot.locator('svg text').allTextContents()).join('\n');
      if (labels.includes('Power requirement met across all five days')) {
        assert.equal(await plot.locator('.barlayer .point').count(), 3, 'All three percentage bars must actually render');
        const data = await plot.evaluate(p => p.data.filter(t => t.type === 'bar').map(t => t.y));
        assert.deepEqual(data, [[100 * 53 / 119, 100 * 107 / 119, 100]]);
      }
      const pending = page.waitForEvent('download');
      await plot.locator('[data-title*="Download plot"]').click();
      const png = await pending; const filename = `u08-figure-${k + 1}.png`;
      await png.saveAs(path.join(__dirname, filename)); const bytes = fs.readFileSync(path.join(__dirname, filename));
      assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
      evidence.push({ label: 'actual camera export', filename, width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), labels });
      await closeFigures();
    }
    await closeFigures();
    assert.equal(await page.getByRole('region', { name: 'Saved figures' }).locator('li').count(), 2);
    await runTests('completed reference', 12);
    assert.equal(await page.getByRole('region', { name: 'Saved figures' }).locator('li').count(), 2);
    const saved = {};
    for (const file of files) {
      saved[file] = await download(file);
      assert.equal(normalize(saved[file]), normalize(read('solved', file)));
    }
    const pendingZip = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download All/ }).click();
    const item = await pendingZip;
    const zip = await JSZip.loadAsync(fs.readFileSync(await item.path()));
    for (const file of files) assert.equal(await zip.file(file).async('string'), saved[file]);
    assert.equal(zip.file('solar_station_measurements.csv'), null);
    assert.equal(Object.keys(zip.files).filter(f => f.endsWith('.png')).length, 2);
    assert.equal(Object.keys(zip.files).filter(f => f.endsWith('.figure.json')).length, 2);
    evidence.push({ label: 'downloads preserve completed sources and both exportable figures; CSV excluded' });
    await openFile(files[0]); await page.getByRole('button', { name: 'Reset File', exact: true }).click();
    await page.getByRole('button', { name: 'Reset file', exact: true }).click();
    assert.equal(normalize(await download(files[0])), normalize(read('unsolved', files[0])));
    assert.equal(normalize(await download(files[1])), normalize(saved[files[1]]));
    evidence.push({ label: 'per-file reset restores main starter and preserves completed helper' });
    await setFile(files[0], saved[files[0]]);
    // Let the existing 500 ms editor autosave finish before navigating away.
    await page.waitForTimeout(1000);
    await page.reload(); await ready();
    for (const file of files) assert.equal(await download(file), saved[file]);
    assert.equal(await page.getByRole('region', { name: 'Saved figures' }).locator('li').count(), 2);
    await runTests('returning deep link', 12);
    await setFile(files[1], read('solved', files[1]).replaceAll('met_pct >= minimum_met_pct', 'met_pct > minimum_met_pct'));
    await runTests('strict percentage boundary rejected', 10);
    await setFile(files[1], read('solved', files[1]));
    await setFile(files[0], `${read('solved', files[0])}\nrecommended_index = 2; recommended_system = 'B';\n`);
    await runTests('hard-coded recommendation rejected', 11);
    await setFile(files[0], read('solved', files[0])); await runTests('corrected project', 12);
    assert.deepEqual(pageErrors.filter((e, i) => e !== 'Canceled' && !recoveredErrors.has(i)), []);
    console.log('PASS route, guide, Run File/Tests, PNG/ZIP export, persistence, reset and edited-code recovery');
  } catch (e) { failure = e.stack; throw e; }
  finally {
    fs.writeFileSync(path.join(__dirname, 'u08-last-output.txt'), await output());
    await page.screenshot({ path: path.join(__dirname, 'u08-last.png') });
    fs.writeFileSync(path.join(__dirname, 'u08-results.json'), JSON.stringify({ base, failure, evidence, pageErrors }, null, 2));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
