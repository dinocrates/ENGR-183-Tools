import { useEffect, useRef, useState } from 'react'
import { OctaveKernelSession, type ExecuteChunk } from './kernel/session'
import { createContentsManager, UnitFiles, buildWriteFilesCode } from './kernel/files'
import { downloadFile, downloadZip } from './kernel/download'
import { FileBrowser } from './components/FileBrowser'
import { Editor } from './components/Editor'
import { CommandWindow } from './components/CommandWindow'
import { FloatingFigure } from './components/FloatingFigure'
import { Toolbar, type KernelStatus } from './components/Toolbar'
import { StartupOverlay } from './components/StartupOverlay'
import { ProblemStatement } from './components/ProblemStatement'
import { Workspace, type WorkspaceVar } from './components/Workspace'
import { WHOS_QUERY, parseWhosOutput } from './kernel/workspace'
import type { UnitMeta } from './units'

interface PlaygroundProps {
  unit: UnitMeta
  onBackToUnits: () => void
}

interface Figure {
  id: string
  label: string
  mimeBundle: Record<string, unknown>
  position: { x: number; y: number }
}

function Playground({ unit, onBackToUnits }: PlaygroundProps) {
  const sessionRef = useRef<OctaveKernelSession | null>(null)
  const unitFilesRef = useRef<UnitFiles | null>(null)
  const saveTimers = useRef<Record<string, number>>({})
  const figureCount = useRef(0)
  const zCounter = useRef(1)

  const [status, setStatus] = useState<KernelStatus>('starting')
  const [contents, setContents] = useState<Record<string, string>>({})
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set())
  const [activeFile, setActiveFile] = useState<string>(unit.files[0])
  const [output, setOutput] = useState('')
  const [figures, setFigures] = useState<Figure[]>([])
  const [zIndices, setZIndices] = useState<Record<string, number>>({})
  const [workspaceVars, setWorkspaceVars] = useState<WorkspaceVar[]>([])

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

  function focusFigure(id: string) {
    zCounter.current += 1
    setZIndices((prev) => ({ ...prev, [id]: zCounter.current }))
  }

  function closeFigure(id: string) {
    setFigures((prev) => prev.filter((f) => f.id !== id))
  }

  // Desktop Octave opens each plot in its own Figure window, not inline in
  // the Command Window -- figures are tracked separately from text output.
  // A plot arrives as an empty display_data placeholder (reserving a
  // displayId) followed by an update_display_data with the real figure;
  // patch the existing window in place rather than opening a second one.
  function handleExecuteChunk(chunk: ExecuteChunk) {
    if (chunk.kind === 'stream') {
      setOutput((prev) => prev + chunk.text)
      return
    }
    setFigures((prev) => {
      const existingIdx = chunk.displayId ? prev.findIndex((f) => f.id === chunk.displayId) : -1
      if (existingIdx !== -1) {
        const next = [...prev]
        next[existingIdx] = { ...next[existingIdx], mimeBundle: chunk.mimeBundle }
        return next
      }
      figureCount.current += 1
      const id = chunk.displayId ?? `figure-${figureCount.current}`
      zCounter.current += 1
      setZIndices((z) => ({ ...z, [id]: zCounter.current }))
      const cascade = (prev.length % 5) * 28
      return [
        ...prev,
        {
          id,
          label: `Figure ${figureCount.current}`,
          mimeBundle: chunk.mimeBundle,
          position: { x: 24 + cascade, y: 24 + cascade },
        },
      ]
    })
  }

  // Runs after every Run Tests/Run File, matching desktop Octave's Workspace
  // panel reflecting the base workspace as of the last command. Queried as a
  // separate execute() call with its own local callback so its output never
  // touches the Command Window or figures -- those are wired to
  // handleExecuteChunk, this isn't.
  async function refreshWorkspace() {
    if (!sessionRef.current) return
    let raw = ''
    try {
      await sessionRef.current.execute(WHOS_QUERY, (chunk) => {
        if (chunk.kind === 'stream') raw += chunk.text
      })
      setWorkspaceVars(parseWhosOutput(raw))
    } catch {
      // best-effort; leave the Workspace panel showing its last-known state
    }
  }

  async function runCode(code: string) {
    if (!sessionRef.current) return
    setStatus('running')
    setOutput('')
    setFigures([])
    try {
      await sessionRef.current.execute(code, handleExecuteChunk)
      setDirtyFiles(new Set())
      setStatus('ready')
      await refreshWorkspace()
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

  function handleDownloadFile() {
    downloadFile(activeFile, contents[activeFile] ?? '')
  }

  function handleDownloadZip() {
    void downloadZip(unit.id, contents)
  }

  return (
    <div className="relative flex h-full flex-col">
      {!kernelReady && <StartupOverlay error={startupError} />}
      <div className="flex items-center gap-2 border-b border-slate-800 bg-slate-950 px-3 py-1">
        <span className="h-2 w-2 rounded-full bg-cyan-400" />
        <span className="text-xs font-medium text-slate-400">
          ENGR-183 Octave Playground <span className="text-slate-600">—</span> {unit.title}
        </span>
      </div>
      <Toolbar
        status={status}
        onRunTests={unit.isScratch ? undefined : handleRunTests}
        onRunFile={handleRunFile}
        onDownloadFile={handleDownloadFile}
        onDownloadZip={handleDownloadZip}
        onBackToUnits={onBackToUnits}
      />
      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-56 flex-col overflow-hidden border-r border-slate-700">
          <FileBrowser
            unitTitle={unit.title}
            files={unit.files}
            activeFile={activeFile}
            dirtyFiles={dirtyFiles}
            onSelect={setActiveFile}
          />
          <Workspace vars={workspaceVars} />
        </div>
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
      {figures.map((figure) => (
        <FloatingFigure
          key={figure.id}
          id={figure.id}
          label={figure.label}
          mimeBundle={figure.mimeBundle}
          initialPosition={figure.position}
          zIndex={zIndices[figure.id] ?? 1}
          onClose={closeFigure}
          onFocus={focusFigure}
        />
      ))}
    </div>
  )
}

export default Playground
