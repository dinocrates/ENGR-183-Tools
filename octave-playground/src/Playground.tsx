import { useEffect, useRef, useState } from 'react'
import { Group, Panel, Separator, type PanelImperativeHandle } from 'react-resizable-panels'
import { OctaveKernelSession, type ExecuteChunk, type ReportedExecuteError } from './kernel/session'
import { DebugSession, type DebugPhase } from './kernel/debug'
import { isBreakableLine } from './kernel/breakpoints'
import {
  createContentsManager,
  UnitFiles,
  buildWriteFilesCode,
  buildMirrorOutputsCode,
  isValidDataFileName,
} from './kernel/files'
import { collectUploads, summarizeUpload } from './kernel/uploads'
import { DebugBar } from './components/DebugBar'
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
import { isBlockComplete, formatReplEcho } from './kernel/replBlocks'
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
  // Set once execute() settles (any path) if this figure never got past its
  // empty placeholder -- a real, intermittent kernel bug (DESIGN.md T3.21)
  // where a plot's real data can silently never arrive even though
  // everything else about the run succeeds. execute_reply is always the
  // *last* message for a command, so once execute() has settled, an empty
  // figure is provably never going to complete -- no point spinning forever.
  failed?: boolean
}

const PLOTLY_MIME = 'application/vnd.plotly.v1+json'

// Bundled read-only data files for this unit (e.g. a CSV the main script
// reads). Malformed names are dropped here rather than risked in generated
// Octave -- see kernel/files.ts's DATA_FILE_NAME_RE.
function validDataFiles(unit: UnitMeta): string[] {
  const declared = unit.dataFiles ?? []
  const ok = declared.filter(isValidDataFileName)
  if (ok.length !== declared.length) {
    console.warn(
      `${unit.id}: ignoring malformed dataFiles entries:`,
      declared.filter((n) => !isValidDataFileName(n)),
    )
  }
  return ok
}

function Playground({ unit, onBackToUnits }: PlaygroundProps) {
  const dataFiles = validDataFiles(unit)
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
  // Student-uploaded data files (non-.m). Read-only, deletable, shown in
  // the File Browser's "My files" group; persisted flat in the drive like
  // any extra, so a returning student sees them again. `.m` uploads are
  // NOT here -- those merge into fileList as ordinary editable files.
  const [uploads, setUploads] = useState<string[]>([])
  // Files the student's own code created (a bare `fopen(name, 'w')`), mirrored
  // out of the ephemeral kernel filesystem into the drive after every run --
  // see DESIGN.md T3.34. Read-only, shown in its own File Browser group,
  // content lives here (not merged into `contents`) since nothing should
  // ever be written back into it through the normal editor/save path.
  const [outputs, setOutputs] = useState<Record<string, string>>({})
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

      // Bundled data files: always fetched fresh, never from (or to) the
      // drive -- the student can't edit them, so a drive copy would only
      // ever be a stale shadow. Loaded into `contents` so every run path's
      // buildWriteFilesCode() seeds them into the kernel alongside the
      // starters.
      const dataNames = validDataFiles(unit)
      const dataContents = dataNames.length > 0 ? await unitFiles.loadDataFiles(dataNames) : {}
      if (cancelled) return

      // retiredFiles (e.g. unit01's old addTwo.m/circleArea.m/greet.m) may
      // still be sitting in a returning student's drive from before a
      // content revision -- excluded here so they're hidden rather than
      // resurfacing as if the student had created them as extras. dataFiles
      // are excluded for the same reason: they're unit content, not a
      // student-created extra.
      const knownFiles = [...unit.files, ...(unit.retiredFiles ?? []), ...dataNames]
      const extraNames = await unitFiles.listExtraFiles(knownFiles)
      if (cancelled) return
      // An extra ending in .m is student code (an "Add File" or a .m
      // upload) -- editable, like any unit file. Anything else in the
      // drive dir is an uploaded data file -> the read-only "My files"
      // group. The directory listing stays the single source of truth.
      const editableExtras = extraNames.filter((n) => /\.m$/i.test(n))
      const uploadNames = extraNames.filter((n) => !/\.m$/i.test(n))
      const extraContents = editableExtras.length > 0 ? await unitFiles.load(editableExtras) : {}
      const uploadContents = uploadNames.length > 0 ? await unitFiles.loadRaw(uploadNames) : {}
      if (cancelled) return

      setContents({ ...loaded, ...extraContents, ...dataContents, ...uploadContents })
      setFileList([...unit.files, ...editableExtras])
      setUploads(Object.keys(uploadContents))

      // Output files from a previous session -- e.g. the student ran code
      // that wrote a result file, closed the tab, and came back later.
      const outputNames = await unitFiles.listOutputFiles()
      if (cancelled) return
      const outputContents = outputNames.length > 0 ? await unitFiles.loadOutputs(outputNames) : {}
      if (cancelled) return
      setOutputs(outputContents)

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
    // Data files, uploaded "My files", and output files are all read-only;
    // Monaco won't fire this for them, but guard anyway so a stray call
    // can't dirty one or overwrite the stored copy.
    if (dataFiles.includes(file) || uploads.includes(file) || file in outputs) return
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
      // wrapNudge shifts the whole 5-step cascade cycle a little further out
      // each time it wraps around -- without it (plain `(prev.length % 5) *
      // 28`), figure 6 lands at the *exact same* position as figure 1 (both
      // get cascade 0), and since figure 6 has a higher z-index, it sits
      // completely on top of figure 1 at identical size -- figure 1 isn't
      // just partly obscured, it's 100% hidden, close button included,
      // making it unclosable by clicking (confirmed via torture testing,
      // DESIGN.md T3.23: Playwright's own actionability check reported the
      // close button's "subtree intercepts pointer events" for the entire
      // retry window). 14px is enough to break the exact overlap while still
      // reading as "the same cascade, one step further" for the common case
      // of a handful of figures well under the wrap point.
      const wrapNudge = Math.floor(prev.length / 5) * 14
      const cascade = (prev.length % 5) * 28 + wrapNudge
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

  // Runs after every Run Tests/Run File/REPL command (including a failed
  // one -- see runCode's `finally` below), same "separate execute() call,
  // own local callback, never touches the Command Window" shape as
  // refreshWorkspace. Picks up any file the student's own code wrote (T3.34)
  // by mirroring new ones out of the ephemeral kernel filesystem into the
  // drive, then re-reading whatever's there through the same ContentsManager
  // the rest of the File Browser already uses -- no stdout-scraping.
  async function syncOutputs() {
    if (!sessionRef.current || !unitFilesRef.current) return
    try {
      await sessionRef.current.execute(buildMirrorOutputsCode(unit.id, Object.keys(contents)), () => {})
      const names = await unitFilesRef.current.listOutputFiles()
      const fresh = names.length > 0 ? await unitFilesRef.current.loadOutputs(names) : {}
      setOutputs(fresh)
    } catch {
      // best-effort; leave the Output files group showing its last-known state
    }
  }

  // Set while the running code is blocked on a line of stdin (an `input()`
  // call). The Command Window swaps to "answer the prompt" mode; the next
  // Enter goes to the kernel via replyToInput() instead of starting a new
  // command.
  const [stdinPrompt, setStdinPrompt] = useState<string | null>(null)

  function handleStdinReply(value: string) {
    if (!sessionRef.current) return
    setOutput((prev) => prev + value + '\n')
    setStdinPrompt(null)
    sessionRef.current.replyToInput(value)
  }

  async function runCode(code: string) {
    if (!sessionRef.current) return
    setStatus('running')
    try {
      await sessionRef.current.execute(code, handleExecuteChunk, (req) => {
        setOutput((prev) => prev + req.prompt)
        setStdinPrompt(req.prompt)
      })
      setDirtyFiles(new Set())
      setStatus('ready')
      await refreshWorkspace()
    } catch (err) {
      // A kernel execution error has already been streamed into `output` in
      // position (with its full "error: called from ..." trace) by
      // session.ts's iopub `error` handler -- don't print it again. Other
      // rejections (the figure(N) timeout, Stop) aren't flagged and still
      // surface here.
      if (!(err as ReportedExecuteError)?.alreadyReported) {
        setOutput((prev) => prev + '\n' + String(err))
      }
      setStatus('error')
    } finally {
      // A prompt left dangling here means execute() ended (timeout, Stop,
      // error) without the input ever being answered -- clear it so the
      // Command Window doesn't stay stuck in "answer the prompt" mode.
      setStdinPrompt(null)
      // execute_reply is always the *last* message for a command -- once
      // execute() has settled (by any path), a figure still showing its
      // empty placeholder is provably never going to receive its real data.
      // Mark it failed instead of leaving it spinning forever.
      setFigures((prev) =>
        prev.map((f) => (Object.keys(f.mimeBundle).length === 0 ? { ...f, failed: true } : f)),
      )
      // Regardless of success/error/Stop -- a script that wrote a file then
      // crashed should still surface what it managed to write before that.
      await syncOutputs()
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

  // ---- debugger -------------------------------------------------------
  // Breakpoint lines per file (1-indexed). Injected as `keyboard;` when a
  // debug run writes the files -- see kernel/breakpoints.ts.
  const [breakpoints, setBreakpoints] = useState<Record<string, number[]>>({})
  const debugRef = useRef<DebugSession | null>(null)
  const [debugPhase, setDebugPhase] = useState<DebugPhase | null>(null)

  function toggleBreakpoint(file: string, line: number) {
    if (!isBreakableLine(contents[file] ?? '', line)) return
    setBreakpoints((prev) => {
      const cur = prev[file] ?? []
      const next = cur.includes(line) ? cur.filter((l) => l !== line) : [...cur, line].sort((a, b) => a - b)
      return { ...prev, [file]: next }
    })
  }

  // E2E test hook (m0-spike-driver/t125) -- pixel-clicking a Monaco gutter
  // is too flaky to rely on. Only exposed when the test flag is set.
  useEffect(() => {
    let enabled = false
    try {
      enabled = localStorage.getItem('engr183-e2e') === '1'
    } catch {
      /* private mode */
    }
    if (enabled) {
      ;(window as unknown as Record<string, unknown>).__bp = {
        get: () => breakpoints,
        toggle: toggleBreakpoint,
        phase: () => debugPhase,
      }
    }
  })

  async function refreshDebugVars() {
    const dbg = debugRef.current
    if (!dbg) return
    try {
      setWorkspaceVars(await dbg.frameVars())
    } catch {
      /* best-effort */
    }
  }

  async function handleDebug() {
    if (!sessionRef.current || debugRef.current) return
    const totalBp = Object.values(breakpoints).reduce((n, l) => n + l.length, 0)
    const writeCode = buildWriteFilesCode(unit.id, contents, breakpoints)
    const code = [writeCode, `run('/engr183/assignments/${unit.id}/${activeFile}')`].join('\n')
    const dbg = new DebugSession(
      sessionRef.current,
      handleExecuteChunk,
      (p) => {
        setDebugPhase(p.phase === 'done' ? null : p)
        if (p.phase === 'paused') void refreshDebugVars()
      },
      breakpoints,
    )
    debugRef.current = dbg
    setStatus('running')
    setOutput(
      (prev) =>
        prev +
        `\n— debugging ${activeFile}` +
        (totalBp === 0
          ? ' — no breakpoints, so this just runs to the end. Click a line in the editor gutter (just left of the line numbers) to set one, then Debug again.\n'
          : `, ${totalBp} breakpoint(s)\n`),
    )
    try {
      await dbg.run(code)
    } catch (err) {
      if (!(err as ReportedExecuteError)?.alreadyReported) {
        setOutput((prev) => prev + '\n' + String(err))
      }
    } finally {
      debugRef.current = null
      setDebugPhase(null)
      setStatus('ready')
      await refreshWorkspace()
    }
  }

  const debugStep = (fn: (d: DebugSession) => void) => () => {
    const d = debugRef.current
    if (d) fn(d)
  }

  // For a student who thinks their code is stuck (an accidental infinite
  // loop, or the figure-reactivation kernel bug -- DESIGN.md T3.21). There's
  // no cooperative interrupt available (see session.ts's stop()), so this
  // kills the kernel and starts a fresh one -- 'starting' reuses the same
  // busy-gating Toolbar/Command Window already have, without bringing back
  // the full-screen StartupOverlay (that's gated on kernelReady, which
  // isn't touched here -- a routine restart should feel lighter than first
  // boot). Variables are cleared; file edits are untouched, since those
  // live in the browser file bridge, not the kernel.
  async function handleStop() {
    setStatus('starting')
    setWorkspaceVars([])
    setOutput(
      (prev) =>
        prev + '\n⏹ Stopped -- restarting the kernel. Variables were cleared, but your files are safe.\n',
    )
    await sessionRef.current?.stop()
    setStatus('ready')
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
    // Uses replBusy (defined below, before the JSX return), NOT
    // status !== 'ready' -- see its comment for why.
    if (replBusy) return

    if (trimmed === 'clc' || trimmed === 'clc;') {
      clearOutput()
      return
    }

    // CommandWindow itself gates on isBlockComplete before ever calling
    // onSubmit (Phase 2), so this should never actually fire in normal use
    // -- kept as a cheap fail-safe rather than trusting that invariant blindly.
    if (!isBlockComplete(command)) {
      setOutput(
        (prev) =>
          prev +
          formatReplEcho(command) +
          "\n(incomplete block reached the kernel unexpectedly -- try Run File for that.)\n\n",
      )
      return
    }

    setOutput((prev) => prev + formatReplEcho(command) + '\n')
    const writeCode = buildWriteFilesCode(unit.id, contents)
    // cd into the unit's assignment dir first, matching what Run File's
    // run(...) does implicitly -- so a REPL command can call a helper
    // function the student just wrote in another file in this unit.
    await runCode([writeCode, `cd('/engr183/assignments/${unit.id}');`, command].join('\n'))
  }

  function handleDownloadFile() {
    downloadFile(activeFile, contents[activeFile] ?? outputs[activeFile] ?? '')
  }

  function handleDownloadZip() {
    // Uploaded "My files" are the student's own inputs, not part of a
    // Canvas submission -- leave them out of the zip alongside whatever the
    // unit already excludes (e.g. a public-check tab). Output files are the
    // opposite of an input: what the student's code produced, so they're
    // folded in rather than excluded.
    void downloadZip(unit.id, { ...contents, ...outputs }, [...(unit.submissionExclude ?? []), ...uploads])
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

  // ---- student file upload (individual files or a Download All .zip) ----
  async function handleUpload(files: FileList | File[]) {
    const result = await collectUploads(files)
    if (result.items.length === 0 && result.skipped.length === 0) return

    const overwrites = result.items.filter(
      (it) => it.kind === 'editable' && (unit.files.includes(it.name) || fileList.includes(it.name)),
    )

    const apply = async () => {
      for (const it of result.items) {
        await unitFilesRef.current?.save(it.name, it.content).catch(() => {})
        setContents((prev) => ({ ...prev, [it.name]: it.content }))
        if (it.kind === 'editable') {
          setFileList((prev) => (prev.includes(it.name) ? prev : [...prev, it.name]))
          setDirtyFiles((prev) => {
            const next = new Set(prev)
            next.delete(it.name)
            return next
          })
        } else {
          setUploads((prev) => (prev.includes(it.name) ? prev : [...prev, it.name]))
        }
      }
      const last = result.items[result.items.length - 1]
      if (last) setActiveFile(last.name)
      const summary = summarizeUpload(result)
      if (summary) setOutput((prev) => prev + summary)
    }

    if (overwrites.length > 0) {
      setConfirmDialog({
        title: overwrites.length === 1 ? `Replace ${overwrites[0].name}?` : 'Replace files?',
        message: `This replaces your current ${overwrites
          .map((o) => o.name)
          .join(', ')} with the uploaded version. This can't be undone.`,
        confirmLabel: 'Replace',
        onConfirm: () => {
          setConfirmDialog(null)
          void apply()
        },
      })
    } else {
      void apply()
    }
  }

  async function doDeleteUpload(name: string) {
    await unitFilesRef.current?.delete(name).catch(() => {})
    setUploads((prev) => prev.filter((n) => n !== name))
    setContents((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
    if (activeFile === name) setActiveFile(unit.files[0])
  }

  function handleDeleteUploadRequest(name: string) {
    setConfirmDialog({
      title: `Remove ${name}?`,
      message: `This removes the uploaded file ${name} from this unit. Your own copy on your computer is untouched.`,
      confirmLabel: 'Remove',
      onConfirm: () => {
        void doDeleteUpload(name)
        setConfirmDialog(null)
      },
    })
  }

  async function doDeleteOutput(name: string) {
    await unitFilesRef.current?.deleteOutput(name).catch(() => {})
    setOutputs((prev) => {
      const next = { ...prev }
      delete next[name]
      return next
    })
    if (activeFile === name) setActiveFile(unit.files[0])
  }

  function handleDeleteOutputRequest(name: string) {
    setConfirmDialog({
      title: `Remove ${name}?`,
      message: `This removes ${name} from your Output files. If your code still writes it, it'll reappear the next time you run.`,
      confirmLabel: 'Remove',
      onConfirm: () => {
        void doDeleteOutput(name)
        setConfirmDialog(null)
      },
    })
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
    // "Fresh start" should also clear whatever the student's code has
    // written out, same as it restores starter code -- T3.34.
    await unitFilesRef.current?.clearOutputs().catch(() => {})
    setOutputs({})
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
      message: `This discards your changes to every file in this unit (${unit.files.join(', ')}) and restores the original starter code, and clears any output files your code created. This can't be undone.`,
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

  // Matches Toolbar's own `busy` (status === 'starting' || 'running') --
  // deliberately NOT `status !== 'ready'`. 'error' is a legitimate at-rest
  // status (a Run Tests/Run File/REPL command that errored still leaves the
  // kernel free to accept the next one; Toolbar's Run buttons already stay
  // enabled through it). The Command Window used to disable on
  // `status !== 'ready'`, which meant the *first* REPL error of a session
  // (even a routine typo or undefined-variable mistake -- not the figure(N)
  // kernel bug) permanently disabled it, since nothing ever set status back
  // to 'ready' afterward -- found via torture testing (DESIGN.md T3.23),
  // where a two-command REPL sequence (a syntax error, then any second
  // command) reproduced a real, permanent lockout, not the environmental
  // flakiness it first looked like.
  const replBusy = status === 'starting' || status === 'running'

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
        onDebug={() => void handleDebug()}
        debugging={debugPhase !== null}
        onStop={() => void handleStop()}
        onDownloadFile={handleDownloadFile}
        onDownloadZip={handleDownloadZip}
        onResetFile={handleResetFile}
        onResetUnit={handleResetUnit}
        onBackToUnits={onBackToUnits}
        canResetFile={unit.files.includes(activeFile)}
        zipExcludes={unit.submissionExclude}
      />
      {debugPhase?.phase === 'paused' && (
        <DebugBar
          frame={debugPhase.frame}
          stack={debugPhase.stack}
          onContinue={debugStep((d) => d.continue())}
          onStepOver={debugStep((d) => d.stepOver())}
          onStepInto={debugStep((d) => d.stepInto())}
          onStepOut={debugStep((d) => d.stepOut())}
          onStop={debugStep((d) => d.stopDebugging())}
        />
      )}
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
                dataFiles={dataFiles}
                uploads={uploads}
                outputs={Object.keys(outputs)}
                protectedFiles={unit.files}
                activeFile={activeFile}
                dirtyFiles={dirtyFiles}
                onSelect={setActiveFile}
                onAddFile={(name) => void handleAddFile(name)}
                onDeleteRequest={handleDeleteFileRequest}
                onUpload={(files) => void handleUpload(files)}
                onDeleteUpload={handleDeleteUploadRequest}
                onDeleteOutput={handleDeleteOutputRequest}
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
            <ProblemStatement
              title={unit.title}
              description={unit.description}
              note={unit.note}
              sourceUrl={unit.sourceUrl}
              dataFiles={dataFiles}
            />
            <Group orientation="vertical" className="flex-1 overflow-hidden">
              <Panel id="editor" defaultSize="70" minSize="15">
                <Editor
                  files={fileList}
                  dataFiles={dataFiles}
                  uploads={uploads}
                  outputs={Object.keys(outputs)}
                  activeFile={activeFile}
                  contents={{ ...contents, ...outputs }}
                  dirtyFiles={dirtyFiles}
                  onSelectTab={setActiveFile}
                  onChange={handleChange}
                  breakpoints={breakpoints[activeFile] ?? []}
                  onToggleBreakpoint={toggleBreakpoint}
                  debugLine={
                    debugPhase?.phase === 'paused' &&
                    (debugPhase.frame.file.split('/').pop() ?? '') === activeFile
                      ? debugPhase.frame.line
                      : null
                  }
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
                  disabled={replBusy}
                  onClear={clearOutput}
                  stdinPrompt={stdinPrompt}
                  onStdinReply={handleStdinReply}
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
          failed={figure.failed}
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
