import { useEffect, useRef, useState } from 'react'
import { OctaveKernelSession } from './kernel/session'
import { createContentsManager, UnitFiles, buildWriteFilesCode } from './kernel/files'
import { FileBrowser } from './components/FileBrowser'
import { Editor } from './components/Editor'
import { CommandWindow } from './components/CommandWindow'
import { Toolbar, type KernelStatus } from './components/Toolbar'
import unit00 from './units/unit00.json'

const unit = unit00

function App() {
  const sessionRef = useRef<OctaveKernelSession | null>(null)
  const unitFilesRef = useRef<UnitFiles | null>(null)
  const saveTimers = useRef<Record<string, number>>({})

  const [status, setStatus] = useState<KernelStatus>('starting')
  const [contents, setContents] = useState<Record<string, string>>({})
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set())
  const [activeFile, setActiveFile] = useState<string>(unit.files[0])
  const [output, setOutput] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const contentsManager = createContentsManager()
      const unitFiles = new UnitFiles(contentsManager, unit.id)
      unitFilesRef.current = unitFiles

      const loaded = await unitFiles.load(unit.files)
      if (cancelled) return
      setContents(loaded)

      const session = new OctaveKernelSession()
      await session.start(contentsManager)
      if (cancelled) return
      sessionRef.current = session
      setStatus('ready')
    })().catch((err) => {
      if (cancelled) return
      setStatus('error')
      setOutput(String(err))
    })
    return () => {
      cancelled = true
      sessionRef.current?.dispose()
    }
  }, [])

  function handleChange(file: string, content: string) {
    setContents((prev) => ({ ...prev, [file]: content }))
    setDirtyFiles((prev) => new Set(prev).add(file))

    window.clearTimeout(saveTimers.current[file])
    saveTimers.current[file] = window.setTimeout(() => {
      unitFilesRef.current?.save(file, content).catch(() => {
        // best-effort persistence; a failed autosave isn't fatal since the
        // in-memory buffer (and the next successful save) still has it
      })
    }, 500)
  }

  async function runCode(code: string) {
    if (!sessionRef.current) return
    setStatus('running')
    setOutput('')
    try {
      await sessionRef.current.execute(code, (chunk) => {
        setOutput((prev) => prev + chunk.text)
      })
      setDirtyFiles(new Set())
      setStatus('ready')
    } catch (err) {
      setOutput((prev) => prev + '\n' + String(err))
      setStatus('error')
    }
  }

  function handleRunTests() {
    const writeCode = buildWriteFilesCode(unit.id, contents)
    void runCode(
      [
        writeCode,
        `addpath('/engr183'); addpath('/engr183/tests');`,
        `engr183.runTests('${unit.id}')`,
      ].join('\n'),
    )
  }

  function handleRunFile() {
    const writeCode = buildWriteFilesCode(unit.id, contents)
    void runCode([writeCode, `run('/engr183/assignments/${unit.id}/${activeFile}')`].join('\n'))
  }

  return (
    <div className="flex h-full flex-col">
      <Toolbar status={status} onRunTests={handleRunTests} onRunFile={handleRunFile} />
      <div className="flex flex-1 overflow-hidden">
        <FileBrowser
          unitTitle={unit.title}
          files={unit.files}
          activeFile={activeFile}
          dirtyFiles={dirtyFiles}
          onSelect={setActiveFile}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Editor
            files={unit.files}
            activeFile={activeFile}
            contents={contents}
            dirtyFiles={dirtyFiles}
            onSelectTab={setActiveFile}
            onChange={handleChange}
          />
          <CommandWindow output={output} />
        </div>
      </div>
    </div>
  )
}

export default App
