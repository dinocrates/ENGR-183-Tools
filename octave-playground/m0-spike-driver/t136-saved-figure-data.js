const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mergeFigureCapture, parseSavedFigure, MAX_SAVED_FIGURES } = require('../src/kernel/savedFigures.ts');
const plot = { data: [{ type: 'scatter', x: [1, 2], y: [3, 4] }], layout: { annotations: [{ text: 'Title' }] } };
const capture = (sourceScript, ids) => ({ sourceScript, plots: new Map(ids.map(id => [id, structuredClone(plot)])) });

test('script reruns replace only that script, including a run with no figures', () => {
  const ids = new Map();
  const first = mergeFigureCapture([], capture('first.m', ['a', 'b']), true, ids);
  const both = mergeFigureCapture(first, capture('second.m', ['c']), true, ids);
  const rerun = mergeFigureCapture(both, capture('first.m', ['d']), true, ids);
  assert.deepEqual(rerun.map(f => f.name), ['second_figure_1.figure.json', 'first_figure_1.figure.json']);
  assert.deepEqual(mergeFigureCapture(rerun, capture('first.m', []), true, ids).map(f => f.sourceScript), ['second.m']);
});

test('command updates keep the source script and replace the right snapshot', () => {
  const ids = new Map();
  const first = mergeFigureCapture([], capture('first.m', ['a']), true, ids);
  const command = capture(null, ['a']);
  command.plots.get('a').data[0].y = [7, 8];
  const result = mergeFigureCapture(first, command, true, ids);
  assert.equal(result.length, 1);
  assert.equal(result[0].sourceScript, 'first.m');
  assert.deepEqual(result[0].plot.data[0].y, [7, 8]);
  assert.deepEqual(first[0].plot.data[0].y, [3, 4]);
});

test('failed runs preserve old figures and add any usable new ones separately', () => {
  const ids = new Map();
  const first = mergeFigureCapture([], capture('first.m', ['a']), true, ids);
  const failed = mergeFigureCapture(first, capture('first.m', ['b']), false, ids);
  assert.equal(failed.length, 2);
  assert.equal(failed[0], first[0]);
  assert.notEqual(failed[0].name, failed[1].name);
});

test('snapshots retain plotted data and annotations, without retaining mutable inputs', () => {
  const c = capture('first.m', ['a']);
  const [snapshot] = mergeFigureCapture([], c, true, new Map());
  c.plots.get('a').data[0].x.push(999);
  assert.deepEqual(snapshot.plot.data[0].x, [1, 2]);
  assert.equal(snapshot.plot.layout.annotations[0].text, 'Title');
  assert.deepEqual(parseSavedFigure(JSON.stringify(snapshot)), snapshot);
});

test('unsupported versions, invalid payloads and unsafe names fail validation', () => {
  const [valid] = mergeFigureCapture([], capture('first.m', ['a']), true, new Map());
  for (const invalid of [
    { ...valid, version: 99 }, { ...valid, plot: { data: 'not traces' } },
    { ...valid, name: '../escape.figure.json' }, { ...valid, sourceScript: 42 },
  ]) assert.throws(() => parseSavedFigure(JSON.stringify(invalid)));
  assert.throws(() => parseSavedFigure(JSON.stringify(valid).replace('"layout":{', '"layout":{"__proto__":{},')));
});

test('archive limits reject the entire change without corrupting live identities', () => {
  const ids = new Map();
  const first = mergeFigureCapture([], capture('first.m', Array.from({ length: MAX_SAVED_FIGURES }, (_, i) => String(i))), true, ids);
  const before = new Map(ids);
  assert.throws(() => mergeFigureCapture(first, capture(null, ['overflow']), true, ids));
  assert.deepEqual(ids, before);
});
