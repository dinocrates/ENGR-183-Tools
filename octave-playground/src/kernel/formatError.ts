// Formatting for kernel execution errors. Kept in its own import-free module
// so it can be unit-tested in plain Node against real captured kernel
// payloads (m0-spike-driver/t121-format-kernel-error.js) without pulling in
// the JupyterLab/JupyterLite dependency graph that session.ts needs.

/** An Error carrying the flag that its text was already streamed to the
 *  caller's output listener (via a 'stream' chunk from the iopub `error`
 *  message), so the caller's catch shouldn't print it a second time. */
export interface ReportedExecuteError extends Error {
  alreadyReported?: boolean;
}

const ANSI_SGR = new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g');

// Wrapper stack frames that only exist because of how this app runs code
// (the REPL / Run File plumbing), never anything the student wrote:
//   "    cell[3] at line 10 column 1"   -- the eval'd command wrapper
//   "    run at line 78 column 7"       -- Octave's builtin run(), used by Run File
// Dropping them makes the trace match what the same error prints in a plain
// desktop Octave session, where you'd run the script directly.
const WRAPPER_FRAME = /^\s*(cell\[\d+\]|run) at line \d+/;

/** Format a kernel error message's fields into the text a desktop Octave
 *  session would print for the same error -- e.g.
 *
 *    error: operator +: nonconformant arguments (op1 is 1x3, op2 is 1x2)
 *    error: called from
 *        classify_temperature at line 5 column 9
 *        analyze_thermal_log at line 4 column 9
 *
 *  Before this, a student whose program spanned several function files got
 *  only the bare message with no hint at which file (or line) raised it.
 *  xeus-octave already provides the whole stack -- it's in `traceback`
 *  (element 0 is "Execution exception: <message>", the rest is Octave's own
 *  "error: called from ..." block) -- the app was just dropping it and
 *  showing `ename: evalue` instead. `ename`/`evalue` are also inconsistently
 *  ordered between the iopub `error` message and the `execute_reply`
 *  (confirmed via m0-spike-driver/t120), which is why the pre-fix output
 *  printed the message twice, once each way; we prefer `traceback` and fall
 *  back to `ename`/`evalue` only when it's absent. */
export function formatKernelError(content: {
  ename?: string;
  evalue?: string;
  traceback?: string[] | string;
}): string {
  // Only reached when `traceback` is absent, which in practice never
  // happens -- xeus-octave always sends it. `evalue` carries the message on
  // the iopub `error` form; `ename` does on the `execute_reply` form.
  const fallback = `error: ${(content.evalue || content.ename || 'unknown error').trim()}`;

  const tb = Array.isArray(content.traceback)
    ? content.traceback
    : typeof content.traceback === 'string'
      ? [content.traceback]
      : [];

  const kept = tb
    .join('\n')
    .replace(ANSI_SGR, '')
    .split('\n')
    .filter((l) => !WRAPPER_FRAME.test(l));

  // If every frame under an "error: called from" header was a wrapper frame
  // (so the header now dangles with nothing beneath it), drop the header too.
  const cleaned = kept.filter((l, i) => {
    if (!/^\s*error: called from\s*$/.test(l)) return true;
    return kept.slice(i + 1).some((rest) => / at line \d+/.test(rest));
  });

  const text = cleaned
    .join('\n')
    // "Execution exception: <msg>" is xeus-octave's own wrapper prefix; a
    // desktop session just says "error: <msg>". Only the leading line.
    .replace(/^Execution exception:\s*/, 'error: ')
    .replace(/\s+$/, '');

  return text || fallback;
}
