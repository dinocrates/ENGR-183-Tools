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

/** Thin wrapper around one running Octave kernel. */
export class OctaveKernelSession {
  private kernel: IKernel | null = null;
  private kernelSpecs = new KernelSpecs();
  private sessionId = crypto.randomUUID();
  private contentsManager: ContentsManager | null = null;
  // Set for the duration of the current in-flight execute() call, cleared
  // once it settles by any path (reply, error, timeout, or this). Lets
  // stop() reject that call immediately instead of the caller having to
  // wait out execute()'s own 60s safety-net timeout -- see stop() below.
  private currentAbort: (() => void) | null = null;

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
   *  execute() call immediately, rather than leaving the caller to wait out
   *  its own 60s timeout, since a user clicking Stop wants instant
   *  feedback. This clears all in-kernel state (Octave variables); file
   *  edits are untouched, since those live in the separate browser file
   *  bridge, not the kernel. */
  async stop(): Promise<void> {
    this.currentAbort?.();
    await this.restart();
  }

  /** Execute code, streaming stdout/stderr text and rich display data (e.g.
   *  plots) as they arrive, in the order the kernel emits them. */
  async execute(code: string, onOutput?: ExecuteListener): Promise<void> {
    if (!this.kernel) {
      throw new Error('Kernel is not started');
    }
    const kernel = this.kernel;

    const requestMsg = KernelMessage.createMessage<KernelMessage.IExecuteRequestMsg>({
      session: this.sessionId,
      channel: 'shell',
      msgType: 'execute_request',
      content: {
        code,
        silent: false,
        store_history: true,
        user_expressions: {},
        allow_stdin: false,
        stop_on_error: true,
      },
    });

    return new Promise<void>((resolve, reject) => {
      // Belt-and-suspenders against a genuine kernel bug found via
      // m0-spike-driver/t104: re-calling figure(N) on an already-open
      // figure intermittently (~1 in 4-5 tries, confirmed via raw message
      // dumps) makes xeus-octave never send update_display_data or
      // execute_reply at all -- Octave's own interpreter finishes the
      // script correctly (any trailing disp() output still arrives), but
      // this specific execute_request just never gets acknowledged. Without
      // this timeout that hangs the UI forever (status stuck 'running',
      // Command Window input stuck disabled) -- a page reload was the only
      // recovery. This can't be fixed from here: the dropped message is a
      // third-party kernel-side bug (xeus-octave's prebuilt WASM binary,
      // not this repo's own source), not a request/response bug in this
      // file. 60s is generous enough not to interrupt legitimate slow
      // student loops (a 200k-iteration for-loop measured well under half
      // that -- see t78-repl.js's calibration comment) while still
      // eventually recovering instead of hanging indefinitely.
      let settled = false;
      const timeoutId = setTimeout(() => {
        if (settled) return;
        finish();
        reject(
          new Error(
            'Kernel did not respond in time -- it may be stuck (a known intermittent issue after ' +
              're-activating a figure with figure(N)). Try running again; reload the page if it keeps happening.',
          ),
        );
      }, 60000);

      const finish = () => {
        settled = true;
        clearTimeout(timeoutId);
        if (this.currentAbort === abort) this.currentAbort = null;
      };

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
        if (msg.header.msg_type === 'stream') {
          const content = (msg as KernelMessage.IStreamMsg).content;
          onOutput?.({
            kind: 'stream',
            channel: content.name === 'stderr' ? 'stderr' : 'stdout',
            text: content.text,
          });
        } else if (msg.header.msg_type === 'error') {
          const content = (msg as KernelMessage.IErrorMsg).content;
          onOutput?.({
            kind: 'stream',
            channel: 'stderr',
            text: `${content.ename}: ${content.evalue}`,
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
          onOutput?.({
            kind: 'display',
            displayId: content.transient?.display_id as string | undefined,
            mimeBundle: content.data as Record<string, unknown>,
          });
        } else if (msg.header.msg_type === 'execute_reply') {
          finish();
          const content = (msg as KernelMessage.IExecuteReplyMsg).content;
          if (content.status === 'error') {
            reject(new Error(`${content.ename}: ${content.evalue}`));
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
    this.kernel?.dispose();
    this.kernel = null;
  }
}
