import { KernelManager, KernelSpecManager } from '@jupyterlab/services';

window.__engr183Driver = {
  async run(code) {
    const specManager = new KernelSpecManager();
    await specManager.ready;
    const specNames = Object.keys(specManager.specs?.kernelspecs || {});

    const km = new KernelManager();
    await km.ready;
    const kernel = await km.startNew({ name: 'xoctave' });

    let output = '';
    let errored = false;
    const future = kernel.requestExecute({ code });
    future.onIOPub = (msg) => {
      const t = msg.header.msg_type;
      if (t === 'stream') {
        output += msg.content.text;
      } else if (t === 'error') {
        errored = true;
        output += '[error] ' + msg.content.ename + ': ' + msg.content.evalue;
      } else if (t === 'execute_result') {
        output += JSON.stringify(msg.content.data);
      }
    };
    await future.done;
    const kernelInfo = await kernel.info;
    await kernel.shutdown();

    return { specNames, output, errored, banner: kernelInfo.banner };
  },
};
