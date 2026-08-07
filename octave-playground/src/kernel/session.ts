// Drives an xeus-octave kernel directly, in-process -- no notebook/lab
// frontend, no fetch/WebSocket to a "server" (there isn't one). Constructed
// entirely from @jupyterlite/services + @jupyterlite/xeus building blocks;
// see M0-FINDINGS.md T0.9 for why a bare @jupyterlab/services client can't
// do this from outside its own bundle, and why this has to be built in here
// instead.
import { KernelMessage, ContentsManager } from '@jupyterlab/services';
import { KernelSpecs, BrowserStorageDrive, type IKernel } from '@jupyterlite/services';
import { WebWorkerKernel } from '@jupyterlite/xeus';
import { PageConfig } from '@jupyterlab/coreutils';
import localforage from 'localforage';

const KERNEL_NAME = 'xoctave';
const ENV_NAME = 'xeus-kernel';

function ensurePageConfig(): void {
  if (document.getElementById('jupyter-config-data')) {
    return;
  }
  const el = document.createElement('script');
  el.id = 'jupyter-config-data';
  el.type = 'application/json';
  el.textContent = JSON.stringify({ baseUrl: import.meta.env.BASE_URL });
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

  async start(): Promise<void> {
    ensurePageConfig();

    const drive = new BrowserStorageDrive({
      name: 'engr183-drive',
      localforage,
    });
    const contentsManager = new ContentsManager({ defaultDrive: drive });

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
    this.kernel?.dispose();
    this.kernel = null;
    await this.start();
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
