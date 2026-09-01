// Drives Octave's built-in debugger through the kernel's stdin channel.
//
// Mechanism (see breakpoints.ts and m0-spike-driver/t123-debugger-
// feasibility): a breakpoint is a `keyboard` statement spliced onto a
// source line. When execution reaches it the interpreter pauses and issues
// an input_request with prompt "debug> ". Everything else -- step, continue,
// inspect, call stack -- is a command sent back on that same channel via
// OctaveKernelSession.replyToInput(), whose reply is more stdout followed
// by the next "debug> " prompt.
//
// This class turns that raw back-and-forth into a small state machine:
// run() a debug session, then step/continue/inspect while `phase` is
// 'paused'.
import type { OctaveKernelSession, ExecuteChunk } from './session';
import type { WorkspaceVar } from '../components/Workspace';
import { parseWhosOutput } from './workspace';
import { fileLineToEditor } from './breakpoints';

export interface DebugFrame {
  /** e.g. "classify_temperature" or "classify_temperature>triple" */
  fn: string;
  /** kernel FS path, or a synthetic name like "cell[1]" for the REPL wrapper */
  file: string;
  line: number;
}

export type DebugPhase =
  | { phase: 'running' }
  | { phase: 'paused'; frame: DebugFrame; stack: DebugFrame[] }
  | { phase: 'done' };

const DEBUG_PROMPT = /(^|\n)\s*debug>\s*$/;
// A dbstack row: optional "-->", then "<fn> at line <n> [<file>]".
const STACK_ROW = /^\s*(-->)?\s*([^\s[]+) at line (\d+) \[([^\]]+)\]\s*$/;

// One-line `whos` for the paused frame: name|size|class per row, matching
// what parseWhosOutput expects (WHOS_QUERY's format, collapsed to one line).
const FRAME_WHOS =
  "__d=whos();for __k=1:numel(__d),printf('%s|%s|%s\\n'," +
  "__d(__k).name,strtrim(mat2str(__d(__k).size)),__d(__k).class);end;clear __d __k";

function isWrapperFrame(f: DebugFrame): boolean {
  return /^cell\[\d+\]$/.test(f.file) || f.file === 'run' || /(^|\/)run$/.test(f.fn);
}

export class DebugSession {
  private session: OctaveKernelSession;
  private onOutput: (c: ExecuteChunk) => void;
  private onPhase: (p: DebugPhase) => void;

  // Text streamed since the last command was sent -- what a query's answer
  // is carved out of, and where the "stopped in ..." banner is found.
  private buf = '';
  // Resolver for an in-flight inspect query (evaluate / frameVars / an
  // internal dbstack).
  private pendingQuery: ((out: string) => void) | null = null;
  // While true, stream chunks are buffered but NOT forwarded to onOutput --
  // set for the internal dbstack/whos queries so their machine-readable
  // output doesn't spam the Command Window.
  private suppressOutput = false;
  // Set once dbcont/dbquit has been sent and we're waiting to see whether
  // the program finishes or hits the next breakpoint.
  private resuming = false;
  private finished = false;
  private runPromise: Promise<void> | null = null;

  // Editor breakpoint lines per file basename -- used to map the line
  // numbers the debugger reports (in the keyboard-injected file) back to
  // the lines the editor shows.
  private breakpoints: Record<string, number[]>;

  constructor(
    session: OctaveKernelSession,
    onOutput: (c: ExecuteChunk) => void,
    onPhase: (p: DebugPhase) => void,
    breakpoints: Record<string, number[]> = {},
  ) {
    this.session = session;
    this.onOutput = onOutput;
    this.onPhase = onPhase;
    this.breakpoints = breakpoints;
  }

  private toEditorLine(file: string, fileLine: number): number {
    const base = file.split('/').pop() ?? file;
    return fileLineToEditor(fileLine, this.breakpoints[base] ?? []);
  }

  /** Start a debug run. Resolves when the program finishes (or is stopped
   *  with stopDebugging / an error / the kernel timeout). */
  run(code: string): Promise<void> {
    this.onPhase({ phase: 'running' });
    this.runPromise = this.session
      .execute(
        code,
        (chunk) => {
          if (chunk.kind === 'stream') this.buf += chunk.text;
          if (!(this.suppressOutput && chunk.kind === 'stream')) this.onOutput(chunk);
        },
        (req) => void this.handlePrompt(req.prompt),
      )
      .finally(() => {
        this.finished = true;
        this.pendingQuery?.('');
        this.pendingQuery = null;
        this.onPhase({ phase: 'done' });
      });
    return this.runPromise;
  }

  get isPaused(): boolean {
    return !this.finished && !this.resuming && this.pendingQuery === null;
  }

  stepOver(): void {
    this.sendStep('dbstep');
  }
  stepInto(): void {
    this.sendStep('dbstep in');
  }
  stepOut(): void {
    this.sendStep('dbstep out');
  }
  continue(): void {
    this.resuming = true;
    this.onPhase({ phase: 'running' });
    this.buf = '';
    this.session.replyToInput('dbcont');
  }
  /** Abort the whole run (Octave's `dbquit`). */
  stopDebugging(): void {
    this.resuming = true;
    this.buf = '';
    this.session.replyToInput('dbquit');
  }

  /** Evaluate an expression in the paused frame and return its printed
   *  output. The expression and its result DO show in the Command Window
   *  (the student asked for it). '' if not currently paused. */
  evaluate(expr: string): Promise<string> {
    return this.query(expr, false);
  }

  /** `whos` for the paused frame, parsed for the Workspace panel. Its raw
   *  output is kept out of the Command Window. */
  async frameVars(): Promise<WorkspaceVar[]> {
    const raw = await this.query(FRAME_WHOS, true);
    return parseWhosOutput(raw);
  }

  // --- internals ---------------------------------------------------------

  private sendStep(cmd: string): void {
    if (!this.isPaused) return;
    this.buf = '';
    this.resuming = false;
    this.session.replyToInput(cmd);
  }

  private query(cmd: string, suppress: boolean): Promise<string> {
    if (this.finished || this.pendingQuery) return Promise.resolve('');
    return new Promise<string>((resolve) => {
      this.pendingQuery = resolve;
      this.suppressOutput = suppress;
      this.buf = '';
      this.session.replyToInput(cmd);
    });
  }

  /** Called every time the kernel issues an input_request. If it's a
   *  "debug> " prompt we've landed at a pause point; figure out where and
   *  publish the new phase. */
  private async handlePrompt(prompt: string): Promise<void> {
    if (!DEBUG_PROMPT.test(`\n${prompt}`)) {
      // Not a debug prompt (an ordinary input() inside the program while
      // debugging) -- leave it for the normal input handler.
      return;
    }

    // A query's answer is everything streamed since we sent it, up to now.
    if (this.pendingQuery) {
      const resolve = this.pendingQuery;
      this.pendingQuery = null;
      this.suppressOutput = false;
      resolve(this.buf.replace(DEBUG_PROMPT, '').trimEnd());
      return;
    }

    this.resuming = false;

    // Fresh pause (initial stop, post-step, or a dbcont that hit the next
    // breakpoint). dbstack is the source of truth for where we are.
    const stack = this.parseStack(await this.query('dbstack', true));
    let top = stack[0];
    if (!top) return; // shouldn't happen; stay in whatever phase we were

    // We paused on an injected `keyboard;` line (its file line is one of
    // the injected positions -> toEditorLine maps it straight to the
    // breakpoint line). Step once so we land ON the student's line, about
    // to run it -- normal breakpoint semantics, and the first user step
    // then does something visible.
    if (this.pausedOnInjectedLine(top)) {
      const after = this.parseStack(await this.query('dbstep', true));
      if (after[0]) {
        top = after[0];
        stack.splice(0, stack.length, ...after);
      }
    }

    const editorStack = stack.map((f) => ({ ...f, line: this.toEditorLine(f.file, f.line) }));
    this.onPhase({ phase: 'paused', frame: editorStack[0], stack: editorStack });
  }

  private pausedOnInjectedLine(f: DebugFrame): boolean {
    const base = f.file.split('/').pop() ?? f.file;
    const bp = [...(this.breakpoints[base] ?? [])].sort((a, b) => a - b);
    // injected keyboard for the i-th breakpoint sits at file line bp[i]+i
    return bp.some((line, i) => line + i === f.line);
  }

  private parseStack(raw: string): DebugFrame[] {
    const frames: DebugFrame[] = [];
    for (const line of raw.split('\n')) {
      const m = line.match(STACK_ROW);
      if (!m) continue;
      const f: DebugFrame = { fn: m[2], file: m[4], line: Number(m[3]) };
      if (!isWrapperFrame(f)) frames.push(f);
    }
    return frames;
  }
}
