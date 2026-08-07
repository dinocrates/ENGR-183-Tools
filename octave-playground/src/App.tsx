import { useRef, useState } from 'react'
import { OctaveKernelSession } from './kernel/session'

function App() {
  const sessionRef = useRef<OctaveKernelSession | null>(null)
  const [status, setStatus] = useState('idle')
  const [output, setOutput] = useState('')

  async function start() {
    setStatus('starting')
    setOutput('')
    try {
      const session = new OctaveKernelSession()
      await session.start()
      sessionRef.current = session
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setOutput(String(err))
    }
  }

  async function run(code: string) {
    if (!sessionRef.current) return
    setStatus('running')
    try {
      await sessionRef.current.execute(code, (chunk) => {
        setOutput((prev) => prev + chunk.text)
      })
      setStatus('ready')
    } catch (err) {
      setStatus('error')
      setOutput((prev) => prev + '\n' + String(err))
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 p-4 text-sm text-neutral-200">
      <div className="flex gap-2">
        <button className="rounded bg-neutral-700 px-3 py-1" onClick={start}>
          Start kernel
        </button>
        <button
          className="rounded bg-neutral-700 px-3 py-1"
          onClick={() => run("printf('%d\\n', 1+1)")}
        >
          Run 1+1
        </button>
        <button
          className="rounded bg-neutral-700 px-3 py-1"
          onClick={() =>
            run(
              [
                "mkdir('/engr183/assignments')",
                "mkdir('/engr183/assignments/unit00')",
                "fid = fopen('/engr183/assignments/unit00/addTwo.m', 'w'); fputs(fid, sprintf('function s = addTwo(a, b)\\n  s = a + b;\\nend\\n')); fclose(fid);",
                "addpath('/engr183'); addpath('/engr183/tests');",
                "engr183.runTests('unit00')",
              ].join('\n'),
            )
          }
        >
          Run harness (write-then-run smoke test)
        </button>
        <span>status: {status}</span>
      </div>
      <pre className="flex-1 overflow-auto whitespace-pre-wrap rounded bg-black p-3 font-mono text-xs text-green-400">
        {output}
      </pre>
    </div>
  )
}

export default App
