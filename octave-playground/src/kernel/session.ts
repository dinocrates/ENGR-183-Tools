// Drives an xeus-octave kernel directly, in-process -- no notebook/lab
// frontend, no fetch/WebSocket to a "server" (there isn't one). Constructed
// entirely from @jupyterlite/services + @jupyterlite/xeus building blocks;
// see M0-FINDINGS.md T0.9 for why a bare @jupyterlab/services client can't
// do this from outside its own bundle, and why this has to be built in here
// instead.
import { KernelMessage, type ContentsManager } from '@jupyterlab/services';
import { KernelSpecs, type IKernel } from '@jupyterlite/services';
import { WebWorkerKernel } from '@jupyterlite/xeus';
import { PageConfig } from '@jupyterlab/coreutils';
import { installPlotTitleCode, PlotTitles } from './plotTitles';

const KERNEL_NAME = 'xoctave';
const ENV_NAME = 'xeus-kernel';

function ensurePageConfig(): void {
  // Fallback only -- index.html's inline script normally already did this,
  // and has to: PageConfig memoizes on first read, and something in the
  // jupyterlite/jupyterlab import graph reads it at module-init time, before
  // this function ever runs. See index.html's comment for the full story.
  if (document.getElementById('jupyter-config-data')) {
    return;
  }
  // import.meta.env.BASE_URL is intentionally relative (vite.config.ts sets
  // base: './' for portability) -- e.g. just './'. Worker scripts resolve
  // relative asset paths against their own script location, not the page,
  // so a bare relative baseUrl silently resolves kernel asset URLs to the
  // domain root once deployed under a subpath (only reproduces once actually
  // deployed there -- local dev serves from origin root, where relative and
  // absolute happen to be identical). Resolve to an absolute URL instead.
  const absoluteBaseUrl = new URL(import.meta.env.BASE_URL, window.location.href).href;
  const el = document.createElement('script');
  el.id = 'jupyter-config-data';
  el.type = 'application/json';
  el.textContent = JSON.stringify({ baseUrl: absoluteBaseUrl });
  document.head.appendChild(el);
}

export type ExecuteChunk =
  | { kind: 'stream'; channel: 'stdout' | 'stderr'; text: string }
  | { kind: 'display'; displayId?: string; mimeBundle: Record<string, unknown> };

export type ExecuteListener = (chunk: ExecuteChunk) => void;

/** Fired when the running code asks for a line of stdin -- Octave's
 *  `input()` / `keypress`, or an interactive `debug>` prompt. The caller
 *  answers by calling OctaveKernelSession.replyToInput(); until it does,
 *  the kernel is blocked waiting. */
export type InputRequestListener = (req: { prompt: string; password: boolean }) => void;

import { formatKernelError, type ReportedExecuteError } from './formatError';
// Re-exported so callers can keep importing error helpers from './session'.
export { formatKernelError } from './formatError';
export type { ReportedExecuteError } from './formatError';

/** Thin wrapper around one running Octave kernel. */
export class OctaveKernelSession {
  /** A long execution is advisory, not evidence of a hung kernel. */
  onSlowExecution: ((slow: boolean) => void) | null = null;
  private plotTitles = new PlotTitles();
  private kernel: IKernel | null = null;
  private kernelSpecs = new KernelSpecs();
  private sessionId = crypto.randomUUID();
  private contentsManager: ContentsManager | null = null;
  // Set for the duration of the current in-flight execute() call, cleared
  // once it settles by any path (reply, error, or Stop). Lets stop() reject
  // that call immediately while restarting the kernel -- see stop() below.
  private currentAbort: (() => void) | null = null;
  // msg_ids of the input_reply messages we've sent. After an input_reply is
  // handled, the kernel stamps *its* header as the parent of subsequent
  // output (not the original execute_request), so execute()'s parent-id
  // guard has to accept these too or it drops every debug-prompt reply and
  // its output. Cleared per execute().
  private inputReplyIds = new Set<string>();
  // Set by the in-flight execute() so replyToInput() can re-arm its
  // long-execution notice: an outstanding input_request means the
  // kernel is waiting on us, not hung.
  private onReplySent: (() => void) | null = null;

  /** contentsManager is shared with files.ts's UnitFiles -- both the kernel
   *  (mountDrive: true, below) and the browser-side file bridge need to see
   *  the same BrowserStorageDrive. */
  async start(contentsManager: ContentsManager): Promise<void> {
    ensurePageConfig();
    this.contentsManager = contentsManager;

    const kernelSpec = {
      name: KERNEL_NAME,
      display_name: 'Octave (xoctave)',
      language: 'octave',
      argv: [`xeus/${ENV_NAME}/bin/${KERNEL_NAME}.js`, '-f', '{connection_file}'],
      resources: {},
      dir: `xeus/${ENV_NAME}/${KERNEL_NAME}`,
      envName: ENV_NAME,
    };

    this.kernelSpecs.register({
      spec: kernelSpec as unknown as import('@jupyterlab/services').KernelSpec.ISpecModel,
      create: async (options) =>
        new WebWorkerKernel({
          ...options,
          contentsManager,
          mountDrive: true,
          kernelSpec,
          browsingContextId: crypto.randomUUID(),
          empackEnvMetaLink: `${PageConfig.getBaseUrl()}xeus/${ENV_NAME}`,
        }),
    });

    const factory = this.kernelSpecs.factories.get(KERNEL_NAME);
    if (!factory) {
      throw new Error(`No kernel factory registered for ${KERNEL_NAME}`);
    }

    this.kernel = await factory({
      id: crypto.randomUUID(),
      name: KERNEL_NAME,
      location: '',
      sendMessage: () => {
        // per-execute listeners are attached in execute(); this default is
        // only hit for messages with no in-flight execute() call.
      },
    });

    await this.kernel.ready;
    this.plotTitles = new PlotTitles();
    await this.execute(installPlotTitleCode());
  }

  async restart(): Promise<void> {
    if (!this.contentsManager) {
      throw new Error('Kernel was never started');
    }
    this.kernel?.dispose();
    this.kernel = null;
    await this.start(this.contentsManager);
  }

  /** For a student who believes their code is stuck (an accidental infinite
   *  loop, or the figure-reactivation kernel bug documented in DESIGN.md
   *  T3.21). There's no cooperative interrupt in this architecture --
   *  IKernel (the interface the Octave kernel implements) exposes nothing
   *  but handleMessage()/dispose(), no pause or cancel -- so "stop" can only
   *  mean "kill the kernel and start a fresh one," which is exactly what
   *  restart() already does. currentAbort() rejects the in-flight
   *  execute() call immediately, since a user clicking Stop wants instant
   *  feedback. This clears all in-kernel state (Octave variables); file
   *  edits are untouched, since those live in the separate browser file
   *  bridge, not the kernel. */
  async stop(): Promise<void> {
    this.currentAbort?.();
    await this.restart();
  }

  /** Send one line of stdin to the kernel, answering an outstanding
   *  input_request (see InputRequestListener). No-op if nothing is waiting. */
  replyToInput(value: string): void {
    if (!this.kernel) return;
    const msg = KernelMessage.createMessage<KernelMessage.IInputReplyMsg>({
      session: this.sessionId,
      channel: 'stdin',
      msgType: 'input_reply',
      content: { status: 'ok', value },
    });
    this.inputReplyIds.add(msg.header.msg_id);
    this.onReplySent?.(); // re-arm the in-flight execute()'s notice timer
    const kernel = this.kernel;
    // Deferred: replyToInput is often called from *inside* the
    // onInputRequest callback (the debugger sends dbstep/dbstack the moment
    // it sees a `debug>` prompt). The kernel's coincident stdin bridge
    // sets up the promise it's about to await *after* it synchronously
    // dispatches the input_request to us -- so replying in the same tick
    // resolves the wrong (previous) promise and the real one hangs forever.
    // A microtask lets the bridge finish wiring first.
    queueMicrotask(() => void kernel.handleMessage(msg));
  }

  /** Execute code, streaming stdout/stderr text and rich display data (e.g.
   *  plots) as they arrive, in the order the kernel emits them.
   *
   *  onInputRequest fires if the code calls `input()` (or otherwise reads
   *  stdin); answer it with replyToInput(). Without a handler the kernel
   *  blocks until Stop -- the caller must provide a handler for code that
   *  can ask for input. */
  async execute(
    code: string,
    onOutput?: ExecuteListener,
    onInputRequest?: InputRequestListener,
  ): Promise<void> {
    if (!this.kernel) {
      throw new Error('Kernel is not started');
    }
    const kernel = this.kernel;
    this.inputReplyIds.clear();

    const requestMsg = KernelMessage.createMessage<KernelMessage.IExecuteRequestMsg>({
      session: this.sessionId,
      channel: 'shell',
      msgType: 'execute_request',
      content: {
        code,
        silent: false,
        store_history: true,
        user_expressions: {},
        // The kernel already routes an input_request through this file's
        // message handler even when this is false -- it just hung, because
        // nothing answered. With a handler wired below, `input()` works.
        allow_stdin: true,
        stop_on_error: true,
      },
    });

    return new Promise<void>((resolve, reject) => {
      // A missing execute_reply can mean a long calculation, an infinite
      // loop, or the intermittent figure(N) kernel bug (T3.21). Elapsed
      // time cannot distinguish them. Warn after 60s, keep accepting all
      // replies, and let the student explicitly Stop/restart if needed.
      let settled = false;
      // Set once an iopub `error` message has been streamed to onOutput, so
      // the execute_reply's own reject can tell runCode()'s catch not to
      // print the same error text a second time.
      let sawError = false;
      let timeoutId = 0 as unknown as ReturnType<typeof setTimeout>;
      const armTimeout = () => {
        clearTimeout(timeoutId);
        this.onSlowExecution?.(false);
        timeoutId = setTimeout(() => {
          if (settled) return;
          this.onSlowExecution?.(true);
        }, 60000);
      };

      const finish = () => {
        settled = true;
        this.onReplySent = null;
        clearTimeout(timeoutId);
        this.onSlowExecution?.(false);
        if (this.currentAbort === abort) this.currentAbort = null;
      };

      armTimeout();
      // While the kernel is blocked waiting for *us* (an input()/debug>
      // prompt) it isn't stuck -- replyToInput() re-arms this when we
      // answer, and the input_request handler suspends it until then.
      this.onReplySent = armTimeout;

      // Lets stop() interrupt this call immediately -- see stop()'s own
      // comment for why "abort" here can only mean "give up waiting," not a
      // true cooperative cancel.
      const abort = () => {
        if (settled) return;
        finish();
        reject(new Error('Stopped by user.'));
      };
      this.currentAbort = abort;

      // Reassigning sendMessage per-call keeps this simple; only one
      // execute() runs at a time in M1's UI (Toolbar disables Run while busy).
      (kernel as unknown as { sendMessage: IKernel.SendMessage }).sendMessage = (
        msg: KernelMessage.IMessage,
      ) => {
        if (settled) return; // a stray message arriving after we've already given up
        // Found via torture testing (DESIGN.md T3.23), confirmed with a raw
        // message dump: this request's own trailing messages (routinely an
        // idle 'status', but under heavier REPL load also real stream/reply
        // content -- reproduced as a stray disp() output from an earlier,
        // already-finished command landing in a later, unrelated command's
        // transcript) can arrive *after* sendMessage has already been
        // reassigned to the next execute() call, since reassignment happens
        // the instant the next command is submitted, not when this one's
        // last straggling message actually lands. Every message carries a
        // parent_header pointing back at the request that caused it
        // (standard Jupyter messaging) -- checking it against *this*
        // closure's own requestMsg is a real fix, not a mitigation: it
        // belongs entirely to this file, not the vendored kernel, since nothing
        // here previously verified a message was actually replying to the
        // request this specific closure was built for.
        const parentId = (msg.parent_header as { msg_id?: string } | undefined)?.msg_id;
        if (
          parentId !== undefined &&
          parentId !== requestMsg.header.msg_id &&
          !this.inputReplyIds.has(parentId)
        )
          return;
        if (msg.header.msg_type === 'input_request') {
          // Kernel is now blocked waiting for our reply -- not stuck.
          clearTimeout(timeoutId);
          this.onSlowExecution?.(false);
          const content = (msg as KernelMessage.IInputRequestMsg).content;
          onInputRequest?.({ prompt: content.prompt ?? '', password: content.password ?? false });
        } else if (msg.header.msg_type === 'stream') {
          const content = (msg as KernelMessage.IStreamMsg).content;
          onOutput?.({
            kind: 'stream',
            channel: content.name === 'stderr' ? 'stderr' : 'stdout',
            text: content.text,
          });
        } else if (msg.header.msg_type === 'error') {
          const content = (msg as KernelMessage.IErrorMsg).content;
          sawError = true;
          onOutput?.({
            kind: 'stream',
            channel: 'stderr',
            text: formatKernelError(content) + '\n',
          });
        } else if (
          msg.header.msg_type === 'display_data' ||
          msg.header.msg_type === 'execute_result' ||
          msg.header.msg_type === 'update_display_data'
        ) {
          // xeus-octave's plot() sends an empty display_data placeholder
          // first (reserving a display_id), then the real Plotly figure a
          // moment later as an update_display_data with the same
          // display_id -- confirmed via m0-spike-driver/t26c-msgdump.js.
          // Both are routed the same way; Playground.tsx uses displayId to
          // patch the placeholder in place instead of appending a new block.
          const content = (
            msg as
              | KernelMessage.IDisplayDataMsg
              | KernelMessage.IExecuteResultMsg
              | KernelMessage.IUpdateDisplayDataMsg
          ).content;
          const bundle = content.data as Record<string, unknown>;
          if (this.plotTitles.consume(bundle)) return;
          const displayId = content.transient?.display_id as string | undefined;
          onOutput?.({
            kind: 'display',
            displayId,
            mimeBundle: this.plotTitles.apply(displayId, bundle),
          });
        } else if (msg.header.msg_type === 'execute_reply') {
          finish();
          const content = (msg as KernelMessage.IExecuteReplyMsg).content;
          if (content.status === 'error') {
            const err: ReportedExecuteError = new Error(formatKernelError(content));
            // The iopub `error` message (handled above) has almost always
            // already streamed this same text into the output in the right
            // position; flag it so runCode()'s catch doesn't append a
            // duplicate. If it somehow didn't arrive, this stays false and
            // the catch prints the error as before.
            err.alreadyReported = sawError;
            reject(err);
          } else {
            resolve();
          }
        }
      };

      kernel.handleMessage(requestMsg).catch((err) => {
        if (settled) return;
        finish();
        reject(err as Error);
      });
    });
  }

  dispose(): void {
    this.currentAbort?.();
    this.kernel?.dispose();
    this.kernel = null;
  }
}
