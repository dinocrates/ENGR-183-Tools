// Run with Node 24: node --test t142-csv-data.js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseCsv } = require('../src/components/csv.ts');

test('quoted commas, escaped quotes and embedded newlines remain in their cells', () => {
  const result = parseCsv('\uFEFFName,Note,Value\r\n"A, B","said ""hello""\r\nnext line",001.20\r\n');
  assert.equal(result.error, null);
  assert.deepEqual(result.rows, [
    ['Name', 'Note', 'Value'],
    ['A, B', 'said "hello"\r\nnext line', '001.20'],
  ]);
  assert.equal(result.hasHeader, true);
});

test('blank cells, blank records, whitespace and uneven rows are retained', () => {
  const result = parseCsv('a,,c,\n\n  ,"",x\n1,2,3,4,5');
  assert.deepEqual(result.rows, [['a', '', 'c', ''], [''], ['  ', '', 'x'], ['1', '2', '3', '4', '5']]);
  assert.equal(result.columnCount, 5);
});

test('all record endings work, without manufacturing a final empty row', () => {
  for (const separator of ['\n', '\r', '\r\n']) {
    assert.deepEqual(parseCsv(`1,2${separator}3,4${separator}`).rows, [['1', '2'], ['3', '4']]);
  }
  assert.deepEqual(parseCsv('""').rows, [['']]);
  assert.deepEqual(parseCsv(',').rows, [['', '']]);
  assert.deepEqual(parseCsv('a,').rows, [['a', '']]);
});

test('empty files and a lone BOM have no rows', () => {
  for (const source of ['', '\uFEFF']) {
    assert.deepEqual(parseCsv(source), { rows: [], columnCount: 0, hasHeader: false, error: null });
  }
});

test('malformed quoting reports a row instead of silently displaying incorrect data', () => {
  for (const source of ['a,b\n"unclosed,b', 'a,b\n"closed"junk,b', 'a,b\nun"quoted,b']) {
    const result = parseCsv(source);
    assert.match(result.error, /CSV row 2/);
    assert.deepEqual(result.rows, []);
  }
});

test('numeric and ambiguous text-only files keep their first row as data', () => {
  for (const source of ['1,2\n3,4', 'NaN,-Inf\n2,3', 'alpha,beta\ngamma,delta', 'solo', 'x,1\ny,2']) {
    assert.equal(parseCsv(source).hasHeader, false, source);
  }
});

test('assignment files have the expected headers and original first data rows', () => {
  const assignments = path.join(__dirname, '../../engr183-harness/assignments');
  for (const [file, hasHeader, columns, firstValue] of [
    ['u05-apa05-lake-perris/lake_perris_storage_2025Q1.csv', true, 9, 'PRR'],
    ['u08-project-solar-station/BOM.csv', true, 5, 'Solar panel'],
    ['u08-project-solar-station/solar_station_measurements.csv', false, 11, '1'],
  ]) {
    const result = parseCsv(fs.readFileSync(path.join(assignments, file), 'utf8'));
    assert.equal(result.error, null, file);
    assert.equal(result.hasHeader, hasHeader, file);
    assert.equal(result.columnCount, columns, file);
    assert.equal(result.rows[hasHeader ? 1 : 0][0], firstValue, file);
  }
});
