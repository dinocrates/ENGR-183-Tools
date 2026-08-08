import { useEffect, useRef, useState } from 'react'
import { OctaveKernelSession, type ExecuteChunk } from './kernel/session'
import { createContentsManager, UnitFiles, buildWriteFilesCode } from './kernel/files'
import { FileBrowser } from './components/FileBrowser'
import { Editor } from './components/Editor'
import { CommandWindow } from './components/CommandWindow'
import { Toolbar, type KernelStatus } from './components/Toolbar'
import { StartupOverlay } from './components/StartupOverlay'
import { ProblemStatement } from './components/ProblemStatement'
import type { UnitMeta } from './units'
import type { OutputBlock } from './components/CommandWindow'

interface PlaygroundProps {
  unit: UnitMeta
  onBackToUnits: () => void
}

function Playground({ unit, onBackToUnits }: PlaygroundProps) {
  const sessionRef = useRef<OctaveKernelSession | null>(null)
  const unitFilesRef = useRef<UnitFiles | null>(null)
  const saveTimers = useRef<Record<string, number>>({})

  const [status, setStatus] = useState<KernelStatus>('starting')
  const [contents, setContents] = useState<Record<string, string>>({})
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set())
  const [activeFile, setActiveFile] = useState<string>(unit.files[0])
  const [output, setOutput] = useState<OutputBlock[]>([])

  // Separate from `status`: once the kernel has started successfully the
  // first time, a later Run Tests/Run File failure sets status to 'error'
  // too, but that's a code error in the Command Window, not a reason to
  // bring back the full-screen "Octave didn't start" overlay.
  const [kernelReady, setKernelReady] = useState(false)
  const [startupError, setStartupError] = useState<string | null>(null)

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
      setKernelReady(true)
      setStatus('ready')
    })().catch((err) => {
      if (cancelled) return
      setStartupError(String(err))
      setStatus('error')
    })
    return () => {
      cancelled = true
      sessionRef.current?.dispose()
    }
  }, [unit])

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

  // Consecutive text chunks are merged into one block so the Command Window
  // doesn't spawn a new <pre> per stream event; a display chunk (a plot)
  // always starts its own block so text before/after it stays in order.
  function appendText(text: string) {
    setOutput((prev) => {
      const last = prev[prev.length - 1]
      if (last?.kind === 'text') {
        return [...prev.slice(0, -1), { kind: 'text', text: last.text + text }]
      }
      return [...prev, { kind: 'text', text }]
    })
  }

  function handleExecuteChunk(chunk: ExecuteChunk) {
    if (chunk.kind === 'stream') {
      appendText(chunk.text)
      return
    }
    // A plot arrives as an empty display_data placeholder (reserving a
    // displayId) followed by an update_display_data with the real figure --
    // patch the existing block in place rather than appending a second one.
    setOutput((prev) => {
      const existingIdx = chunk.displayId
        ? prev.findIndex((b) => b.kind === 'plot' && b.displayId === chunk.displayId)
        : -1
      const block: OutputBlock = {
        kind: 'plot',
        displayId: chunk.displayId,
        mimeBundle: chunk.mimeBundle,
      }
      if (existingIdx !== -1) {
        return [...prev.slice(0, existingIdx), block, ...prev.slice(existingIdx + 1)]
      }
      return [...prev, block]
    })
  }

  async function runCode(code: string) {
    if (!sessionRef.current) return
    setStatus('running')
    setOutput([])
    try {
      await sessionRef.current.execute(code, handleExecuteChunk)
      setDirtyFiles(new Set())
      setStatus('ready')
    } catch (err) {
      appendText('\n' + String(err))
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
      {!kernelReady && <StartupOverlay error={startupError} />}
      <Toolbar
        status={status}
        onRunTests={unit.isScratch ? undefined : handleRunTests}
        onRunFile={handleRunFile}
        onBackToUnits={onBackToUnits}
      />
      <div className="flex flex-1 overflow-hidden">
        <FileBrowser
          unitTitle={unit.title}
          files={unit.files}
          activeFile={activeFile}
          dirtyFiles={dirtyFiles}
          onSelect={setActiveFile}
        />
        <div className="flex flex-1 flex-col overflow-hidden">
          <ProblemStatement title={unit.title} description={unit.description} />
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

export default Playground
