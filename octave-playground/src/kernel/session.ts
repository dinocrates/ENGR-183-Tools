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

export interface StreamChunk {
  channel: 'stdout' | 'stderr';
  text: string;
}

export type StreamListener = (chunk: StreamChunk) => void;

/** Thin wrapper around one running Octave kernel. */
export class OctaveKernelSession {
  private kernel: IKernel | null = null;
  private kernelSpecs = new KernelSpecs();
  private sessionId = crypto.randomUUID();
  private contentsManager: ContentsManager | null = null;

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

  /** Execute code, streaming stdout/stderr chunks as they arrive. */
  async execute(code: string, onStream?: StreamListener): Promise<void> {
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
      // Reassigning sendMessage per-call keeps this simple; only one
      // execute() runs at a time in M1's UI (Toolbar disables Run while busy).
      (kernel as unknown as { sendMessage: IKernel.SendMessage }).sendMessage = (
        msg: KernelMessage.IMessage,
      ) => {
        if (msg.header.msg_type === 'stream') {
          const content = (msg as KernelMessage.IStreamMsg).content;
          onStream?.({
            channel: content.name === 'stderr' ? 'stderr' : 'stdout',
            text: content.text,
          });
        } else if (msg.header.msg_type === 'error') {
          const content = (msg as KernelMessage.IErrorMsg).content;
          onStream?.({
            channel: 'stderr',
            text: `${content.ename}: ${content.evalue}`,
          });
        } else if (msg.header.msg_type === 'execute_reply') {
          const content = (msg as KernelMessage.IExecuteReplyMsg).content;
          if (content.status === 'error') {
            reject(new Error(`${content.ename}: ${content.evalue}`));
          } else {
            resolve();
          }
        }
      };

      kernel.handleMessage(requestMsg).catch(reject);
    });
  }

  dispose(): void {
    this.kernel?.dispose();
    this.kernel = null;
  }
}
