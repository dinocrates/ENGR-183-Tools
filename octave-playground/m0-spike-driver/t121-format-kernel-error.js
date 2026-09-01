// Unit test for src/kernel/formatError.ts's formatKernelError(), run against
// the exact kernel error payloads captured live by t120-error-origin.js.
// No browser or kernel build needed: esbuild transpiles the one import-free
// source module and we assert on its output.
//
//   node t121-format-kernel-error.js
const path = require('path');
const esbuild = require('esbuild');

const SRC = path.resolve(__dirname, '../src/kernel/formatError.ts');
const { outputFiles } = esbuild.buildSync({
  entryPoints: [SRC],
  bundle: false,
  format: 'cjs',
  write: false,
  loader: { '.ts': 'ts' },
});
const mod = { exports: {} };
new Function('module', 'exports', outputFiles[0].text)(mod, mod.exports);
const { formatKernelError } = mod.exports;

let pass = 0, fail = 0;
function eq(label, actual, expected) {
  const ok = actual === expected;
  console.log(`${ok ? 'PASS' : 'FAIL'}: ${label}`);
  if (!ok) {
    console.log('  expected:\n' + expected.split('\n').map((l) => '  | ' + l).join('\n'));
    console.log('  actual:\n' + String(actual).split('\n').map((l) => '  | ' + l).join('\n'));
  }
  ok ? pass++ : fail++;
}

// --- Fixtures: verbatim `content` objects from t120's raw Worker-message tap.

// Case A: one function file deep, called from the REPL (execute_reply form,
// where ename/evalue are swapped relative to the iopub error message).
eq(
  'single function file: message + its one student frame, REPL wrapper dropped',
  formatKernelError({
    ename: 'operator +: nonconformant arguments (op1 is 1x3, op2 is 1x2)',
    evalue: 'Execution exception',
    traceback: [
      'Execution exception: operator +: nonconformant arguments (op1 is 1x3, op2 is 1x2)',
      'error: called from\n    classify_temperature at line 5 column 9\n    cell[1] at line 11 column 1\n',
    ],
  }),
  'error: operator +: nonconformant arguments (op1 is 1x3, op2 is 1x2)\n' +
    'error: called from\n' +
    '    classify_temperature at line 5 column 9',
);

// Case B: two function files deep (iopub error-message form).
eq(
  'nested function files: full call chain, REPL wrapper dropped',
  formatKernelError({
    ename: 'Execution exception',
    evalue: 'operator +: nonconformant arguments (op1 is 1x3, op2 is 1x2)',
    traceback: [
      'Execution exception: operator +: nonconformant arguments (op1 is 1x3, op2 is 1x2)',
      'error: called from\n    classify_temperature at line 5 column 9\n    analyze_thermal_log at line 4 column 9\n    cell[2] at line 11 column 1\n',
    ],
  }),
  'error: operator +: nonconformant arguments (op1 is 1x3, op2 is 1x2)\n' +
    'error: called from\n' +
    '    classify_temperature at line 5 column 9\n' +
    '    analyze_thermal_log at line 4 column 9',
);

// Case C: Run File -- an extra `run at line 78` builtin frame plus cell[N],
// both of which a desktop Octave session running the script directly would
// not show, so both are dropped.
eq(
  'Run File: builtin run() and cell[N] frames dropped, student frames kept',
  formatKernelError({
    ename: 'Execution exception',
    evalue: 'operator +: nonconformant arguments (op1 is 1x3, op2 is 1x2)',
    traceback: [
      'Execution exception: operator +: nonconformant arguments (op1 is 1x3, op2 is 1x2)',
      'error: called from\n    classify_temperature at line 5 column 9\n    analyze_thermal_log at line 4 column 9\n    U04_GP04_ThermalMonitor_Starter at line 4 column 2\n    run at line 78 column 7\n    cell[3] at line 10 column 1\n',
    ],
  }),
  'error: operator +: nonconformant arguments (op1 is 1x3, op2 is 1x2)\n' +
    'error: called from\n' +
    '    classify_temperature at line 5 column 9\n' +
    '    analyze_thermal_log at line 4 column 9\n' +
    '    U04_GP04_ThermalMonitor_Starter at line 4 column 2',
);

// A top-level error with no "called from" block at all (e.g. an undefined
// variable typed straight at the REPL) -- just the one message line.
eq(
  'no stack: single error line',
  formatKernelError({
    ename: "'foo' undefined",
    evalue: 'Execution exception',
    traceback: ["Execution exception: 'foo' undefined"],
  }),
  "error: 'foo' undefined",
);

// Degenerate: traceback missing entirely -> fall back to evalue.
eq(
  'missing traceback: falls back to the message',
  formatKernelError({ ename: 'Octave:some-error', evalue: 'something went wrong' }),
  'error: something went wrong',
);

// Explicit error('...') with no student frames: xeus still emits an
// "error: called from" header over nothing but the eval wrapper frame --
// the dangling header must be dropped, not left pointing at nothing.
eq(
  'explicit error() at top level: dangling "called from" header dropped',
  formatKernelError({
    ename: 'Execution exception',
    evalue: 'something broke',
    traceback: [
      'Execution exception: something broke',
      'error: called from\n    cell[1] at line 1 column 1\n',
    ],
  }),
  'error: something broke',
);

// Parse error (real shape captured by t122): single line, "Execution
// exception:" wrapper rewritten to "error:", trailing blank lines trimmed.
eq(
  'parse error: wrapper prefix normalised, no duplication',
  formatKernelError({
    ename: 'Execution exception',
    evalue: 'syntax error near line 12, column 0 in file cell[1]\n',
    traceback: ['Execution exception: syntax error near line 12, column 0 in file cell[1]\n', ''],
  }),
  'error: syntax error near line 12, column 0 in file cell[1]',
);

// Undefined variable at the prompt (real shape from t122).
eq(
  'undefined variable: single error line, wrapper frame dropped',
  formatKernelError({
    ename: 'Execution exception',
    evalue: "'zzz' undefined near line 11, column 1",
    traceback: [
      "Execution exception: 'zzz' undefined near line 11, column 1",
      'error: called from\n    cell[4] at line 11 column 1\n',
    ],
  }),
  "error: 'zzz' undefined near line 11, column 1",
);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
