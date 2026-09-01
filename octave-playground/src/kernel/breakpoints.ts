// Turning "breakpoint on line N" into something the kernel honours.
//
// xeus-octave's `dbstop("fn", N)` is broken (name resolution -- it mangles
// the function to `@fn/`), but a `keyboard` statement executed *inside* a
// running function fully pauses the interpreter and opens a `debug>`
// prompt (see m0-spike-driver/t123-debugger-feasibility). So a breakpoint
// is a `keyboard;` line spliced into the source before the file is written
// to the kernel FS.
//
// It goes in as its *own* line (not appended to the target line): Octave's
// `dbstep` is statement-granular, and a line carrying both `keyboard;` and
// real code would make the first step land back on the same line. The
// cost is that every injected line shifts the ones below it, so line
// numbers the debugger reports have to be mapped back -- fileLineToEditor()
// / editorLineToFile() below.

const KEYBOARD_LINE = 'keyboard;';

const NON_BREAKABLE =
  /^\s*(function|endfunction|end|endif|endfor|endwhile|endswitch|else|elseif|otherwise|case|catch|do|unwind_protect|unwind_protect_cleanup|%|#|$)/;

/** True if a breakpoint on this 1-indexed editor line would do something
 *  useful (a click on any other line is ignored rather than half-accepted). */
export function isBreakableLine(source: string, line: number): boolean {
  const lines = source.split('\n');
  const text = lines[line - 1];
  if (text === undefined) return false;
  if (NON_BREAKABLE.test(text)) return false;
  if (/\.\.\.\s*$/.test(text)) return false; // a continuation line
  const prev = lines[line - 2];
  if (prev !== undefined && /\.\.\.\s*$/.test(prev)) return false; // tail of one
  return true;
}

function sortedBreakpoints(source: string, lines: Iterable<number>): number[] {
  return [...new Set(lines)].filter((n) => isBreakableLine(source, n)).sort((a, b) => a - b);
}

/** Splice a `keyboard;` line above each breakpoint line of `source`. */
export function injectBreakpoints(source: string, lines: Iterable<number>): string {
  const bp = sortedBreakpoints(source, lines);
  if (bp.length === 0) return source;
  const out = source.split('\n');
  // Walk bottom-up so earlier insertions don't shift later indices.
  for (let i = bp.length - 1; i >= 0; i--) {
    const idx = bp[i] - 1;
    const indent = out[idx].match(/^\s*/)?.[0] ?? '';
    out.splice(idx, 0, indent + KEYBOARD_LINE);
  }
  return out.join('\n');
}

/** File positions (1-indexed) of the injected `keyboard;` lines, given the
 *  editor breakpoint lines. The i-th (0-based) breakpoint's keyboard sits
 *  at `bp[i] + i`. */
function injectedLines(bp: number[]): number[] {
  return bp.map((line, i) => line + i);
}

/** Map a line number the debugger reported (in the injected file) back to
 *  the line the editor shows. */
export function fileLineToEditor(fileLine: number, editorBreakpoints: Iterable<number>): number {
  const bp = [...new Set(editorBreakpoints)].sort((a, b) => a - b);
  const injected = injectedLines(bp);
  const hitIdx = injected.indexOf(fileLine);
  if (hitIdx !== -1) return bp[hitIdx]; // paused *on* a keyboard line -> its breakpoint
  return fileLine - injected.filter((x) => x < fileLine).length;
}

/** Map an editor line to its position in the injected file (e.g. to know
 *  which file line a "current" editor line corresponds to). */
export function editorLineToFile(editorLine: number, editorBreakpoints: Iterable<number>): number {
  const bp = [...new Set(editorBreakpoints)].sort((a, b) => a - b);
  return editorLine + bp.filter((b) => b <= editorLine).length;
}
