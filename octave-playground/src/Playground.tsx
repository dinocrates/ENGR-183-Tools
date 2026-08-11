import { useEffect, useRef, useState } from 'react'
import { Group, Panel, Separator, type PanelImperativeHandle } from 'react-resizable-panels'
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
import { ConfirmDialog } from './components/ConfirmDialog'
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

const PLOTLY_MIME = 'application/vnd.plotly.v1+json'

// Crude keyword-balance check for the REPL prompt -- not a real parser, just
// enough to catch the common case (typing a bare `for i = 1:3` and pressing
// Enter) and redirect to Run File with a friendly message instead of
// surfacing Octave's raw "parse error: unexpected end of input". Full
// multi-line continuation support (matching desktop Octave's continuation
// prompt) is Phase 2.
const BLOCK_OPENERS = new Set(['for', 'parfor', 'while', 'if', 'switch', 'function', 'do', 'try'])
const BLOCK_CLOSERS = new Set([
  'end',
  'endfor',
  'endparfor',
  'endwhile',
  'endif',
  'endswitch',
  'endfunction',
  'until',
  'end_try_catch',
])

function looksUnclosed(command: string): boolean {
  const words = command.match(/\b[a-zA-Z_]\w*\b/g) ?? []
  let depth = 0
  for (const word of words) {
    const lower = word.toLowerCase()
    if (BLOCK_OPENERS.has(lower)) depth++
    else if (BLOCK_CLOSERS.has(lower)) depth--
  }
  return depth > 0
}

function Playground({ unit, onBackToUnits }: PlaygroundProps) {
  const sessionRef = useRef<OctaveKernelSession | null>(null)
  const unitFilesRef = useRef<UnitFiles | null>(null)
  const saveTimers = useRef<Record<string, number>>({})
  const figureCount = useRef(0)
  const zCounter = useRef(1)
  const fileBrowserPanelRef = useRef<PanelImperativeHandle>(null)
  const workspacePanelRef = useRef<PanelImperativeHandle>(null)
  const commandWindowPanelRef = useRef<PanelImperativeHandle>(null)

  const [status, setStatus] = useState<KernelStatus>('starting')
  const [contents, setContents] = useState<Record<string, string>>({})
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set())
  // unit.files (from the JSON / scratchUnit const) is the protected/original
  // list -- fileList additionally holds student-added extras, discovered on
  // load by listing the unit's drive directory (see UnitFiles.listExtraFiles)
  // since there's no manifest file, the directory itself is the source of
  // truth for "what extra files exist."
  const [fileList, setFileList] = useState<string[]>(unit.files)
  const [activeFile, setActiveFile] = useState<string>(unit.files[0])
  const [output, setOutput] = useState('')
  const [figures, setFigures] = useState<Figure[]>([])
  const [zIndices, setZIndices] = useState<Record<string, number>>({})
  const [workspaceVars, setWorkspaceVars] = useState<WorkspaceVar[]>([])
  const [fileBrowserCollapsed, setFileBrowserCollapsed] = useState(false)
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false)
  const [commandWindowCollapsed, setCommandWindowCollapsed] = useState(false)
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string
    message: string
    confirmLabel: string
    onConfirm: () => void
  } | null>(null)

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

      // retiredFiles (e.g. unit01's old addTwo.m/circleArea.m/greet.m) may
      // still be sitting in a returning student's drive from before a
      // content revision -- excluded here so they're hidden rather than
      // resurfacing as if the student had created them as extras.
      const knownFiles = [...unit.files, ...(unit.retiredFiles ?? [])]
      const extraNames = await unitFiles.listExtraFiles(knownFiles)
      if (cancelled) return
      const extraContents = extraNames.length > 0 ? await unitFiles.load(extraNames) : {}
      if (cancelled) return

      setContents({ ...loaded, ...extraContents })
      setFileList([...unit.files, ...extraNames])

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
  //
  // Not every 'display' chunk is a plot, though: any unsuppressed statement
  // (e.g. `x = 5` with no trailing `;`, extremely common beginner code) also
  // sends a display chunk -- an execute_result with text/plain content, no
  // display_id, no plotly key. Treating that identically to a real plot
  // popped up an empty "Figure" window for ordinary output that should just
  // print like it would in a real Octave Command Window. Route non-plot
  // display chunks to text output instead of the figures list.
  function handleExecuteChunk(chunk: ExecuteChunk) {
    if (chunk.kind === 'stream') {
      setOutput((prev) => prev + chunk.text)
      return
    }
    const isPlot = PLOTLY_MIME in chunk.mimeBundle
    const isPlotPlaceholder = chunk.displayId !== undefined && Object.keys(chunk.mimeBundle).length === 0
    if (!isPlot && !isPlotPlaceholder) {
      const text = chunk.mimeBundle['text/plain']
      if (typeof text === 'string') {
        setOutput((prev) => prev + text + '\n')
      }
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
      // Start past the app title bar + Toolbar (~74px) and the File Browser
      // column (224px) -- spawning at (24, 24) put every figure directly on
      // top of Run Tests/Run File, silently blocking the button underneath
      // (confirmed via m0-spike-driver/t36b-rerun-debug.js: a click there
      // was being intercepted by the figure window, not reaching the
      // button -- not a re-run/data bug, a z-order UI bug).
      return [
        ...prev,
        {
          id,
          label: `Figure ${figureCount.current}`,
          mimeBundle: chunk.mimeBundle,
          position: { x: 240 + cascade, y: 90 + cascade },
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

  // Output/figures are now persistent (real Octave only clears via clc) --
  // this is the one explicit way to wipe them, wired to the Command
  // Window's Clear button and to a typed `clc` at the REPL prompt.
  function clearOutput() {
    setOutput('')
    setFigures([])
  }

  async function handleReplSubmit(command: string) {
    const trimmed = command.trim()
    if (trimmed === '') return
    // status guard: execute() only supports one in-flight call at a time
    // (session.ts) -- the Command Window's input is already disabled while
    // busy, this is defense-in-depth against a stale prop / fast double-Enter.
    if (status !== 'ready') return

    if (trimmed === 'clc' || trimmed === 'clc;') {
      clearOutput()
      return
    }

    if (looksUnclosed(trimmed)) {
      setOutput(
        (prev) =>
          prev +
          `>> ${command}\n` +
          "Multi-line blocks aren't supported in the console yet -- try Run File for that.\n\n",
      )
      return
    }

    setOutput((prev) => prev + `>> ${command}\n`)
    const writeCode = buildWriteFilesCode(unit.id, contents)
    // cd into the unit's assignment dir first, matching what Run File's
    // run(...) does implicitly -- so a REPL command can call a helper
    // function the student just wrote in another file in this unit.
    await runCode([writeCode, `cd('/engr183/assignments/${unit.id}');`, command].join('\n'))
  }

  function handleDownloadFile() {
    downloadFile(activeFile, contents[activeFile] ?? '')
  }

  function handleDownloadZip() {
    void downloadZip(unit.id, contents)
  }

  async function doResetFile(file: string) {
    const starter = await unitFilesRef.current?.resetToStarter(file)
    if (starter === undefined) return
    setContents((prev) => ({ ...prev, [file]: starter }))
    setDirtyFiles((prev) => {
      const next = new Set(prev)
      next.delete(file)
      return next
    })
  }

  async function handleAddFile(name: string) {
    await unitFilesRef.current?.save(name, '')
    setFileList((prev) => [...prev, name])
    setContents((prev) => ({ ...prev, [name]: '' }))
    setActiveFile(name)
  }

  async function doDeleteFile(file: string) {
    await unitFilesRef.current?.delete(file)
    setFileList((prev) => prev.filter((f) => f !== file))
    setContents((prev) => {
      const next = { ...prev }
      delete next[file]
      return next
    })
    setDirtyFiles((prev) => {
      const next = new Set(prev)
      next.delete(file)
      return next
    })
    if (activeFile === file) {
      setActiveFile(unit.files[0])
    }
  }

  function handleDeleteFileRequest(file: string) {
    setConfirmDialog({
      title: `Delete ${file}?`,
      message: `This permanently deletes ${file}. This can't be undone.`,
      confirmLabel: 'Delete file',
      onConfirm: () => {
        void doDeleteFile(file)
        setConfirmDialog(null)
      },
    })
  }

  async function doResetUnit() {
    for (const file of unit.files) {
      await doResetFile(file)
    }
  }

  function handleResetFile() {
    setConfirmDialog({
      title: `Reset ${activeFile}?`,
      message: `This discards your changes to ${activeFile} and restores the original starter code. This can't be undone.`,
      confirmLabel: 'Reset file',
      onConfirm: () => {
        void doResetFile(activeFile)
        setConfirmDialog(null)
      },
    })
  }

  function handleResetUnit() {
    setConfirmDialog({
      title: `Reset all of ${unit.title}?`,
      message: `This discards your changes to every file in this unit (${unit.files.join(', ')}) and restores the original starter code. This can't be undone.`,
      confirmLabel: 'Reset unit',
      onConfirm: () => {
        void doResetUnit()
        setConfirmDialog(null)
      },
    })
  }

  // Each pane's collapsed state is tracked locally rather than read live from
  // the panel ref, so the header button's icon can reflect it -- but it also
  // needs to stay in sync when a panel gets collapsed by dragging the
  // Separator past its minSize instead of clicking the button, hence the
  // onResize handlers below re-deriving it from panelRef.isCollapsed() after
  // every resize regardless of what triggered it.
  function toggleFileBrowser() {
    const panel = fileBrowserPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }

  function toggleWorkspace() {
    const panel = workspacePanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }

  function toggleCommandWindow() {
    const panel = commandWindowPanelRef.current
    if (!panel) return
    if (panel.isCollapsed()) panel.expand()
    else panel.collapse()
  }

  return (
    <div className="relative flex h-full flex-col">
      {!kernelReady && <StartupOverlay error={startupError} />}
      <div className="flex items-center gap-2 border-b border-line-subtle bg-app px-3 py-1">
        <span className="h-2 w-2 rounded-full bg-cyan-400" />
        <span className="text-xs font-medium text-muted">
          {/* font-pixel only on the fixed prefix, not {unit.title} -- unit
              titles are long and variable-length, a poor fit for a wide
              bitmap font at this small a size. */}
          <span className="font-pixel">ENGR-183 Octave Playground</span>{' '}
          <span className="text-faint">—</span> {unit.title}
        </span>
      </div>
      <Toolbar
        status={status}
        onRunTests={unit.isScratch ? undefined : handleRunTests}
        onRunFile={handleRunFile}
        onDownloadFile={handleDownloadFile}
        onDownloadZip={handleDownloadZip}
        onResetFile={handleResetFile}
        onResetUnit={handleResetUnit}
        onBackToUnits={onBackToUnits}
        canResetFile={unit.files.includes(activeFile)}
      />
      <Group orientation="horizontal" className="flex-1 overflow-hidden">
        <Panel id="sidebar" defaultSize="18" minSize="12" maxSize="40">
          <Group orientation="vertical" className="h-full border-r border-line">
            <Panel
              id="file-browser"
              defaultSize="50"
              minSize="10"
              collapsible
              collapsedSize={29}
              panelRef={fileBrowserPanelRef}
              onResize={() => setFileBrowserCollapsed(!!fileBrowserPanelRef.current?.isCollapsed())}
            >
              <FileBrowser
                unitTitle={unit.title}
                files={fileList}
                protectedFiles={unit.files}
                activeFile={activeFile}
                dirtyFiles={dirtyFiles}
                onSelect={setActiveFile}
                onAddFile={(name) => void handleAddFile(name)}
                onDeleteRequest={handleDeleteFileRequest}
                collapsed={fileBrowserCollapsed}
                onToggleCollapse={toggleFileBrowser}
              />
            </Panel>
            <Separator className="h-1 cursor-row-resize bg-raised transition-colors hover:bg-accent" />
            <Panel
              id="workspace"
              defaultSize="50"
              minSize="10"
              collapsible
              collapsedSize={29}
              panelRef={workspacePanelRef}
              onResize={() => setWorkspaceCollapsed(!!workspacePanelRef.current?.isCollapsed())}
            >
              <Workspace
                vars={workspaceVars}
                collapsed={workspaceCollapsed}
                onToggleCollapse={toggleWorkspace}
              />
            </Panel>
          </Group>
        </Panel>
        <Separator className="w-1 cursor-col-resize bg-raised transition-colors hover:bg-accent" />
        <Panel id="main-content" defaultSize="82">
          <div className="flex h-full flex-col overflow-hidden">
            <ProblemStatement title={unit.title} description={unit.description} />
            <Group orientation="vertical" className="flex-1 overflow-hidden">
              <Panel id="editor" defaultSize="70" minSize="15">
                <Editor
                  files={fileList}
                  activeFile={activeFile}
                  contents={contents}
                  dirtyFiles={dirtyFiles}
                  onSelectTab={setActiveFile}
                  onChange={handleChange}
                />
              </Panel>
              <Separator className="h-1 cursor-row-resize bg-raised transition-colors hover:bg-accent" />
              <Panel
                id="command-window"
                defaultSize="30"
                minSize="8"
                collapsible
                collapsedSize={25}
                panelRef={commandWindowPanelRef}
                onResize={() => setCommandWindowCollapsed(!!commandWindowPanelRef.current?.isCollapsed())}
              >
                <CommandWindow
                  output={output}
                  collapsed={commandWindowCollapsed}
                  onToggleCollapse={toggleCommandWindow}
                  onSubmit={(command) => void handleReplSubmit(command)}
                  disabled={status !== 'ready'}
                  onClear={clearOutput}
                />
              </Panel>
            </Group>
          </div>
        </Panel>
      </Group>
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
      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  )
}

export default Playground
