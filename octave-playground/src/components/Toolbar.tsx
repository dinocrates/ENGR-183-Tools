export type KernelStatus = 'starting' | 'ready' | 'running' | 'error'

interface ToolbarProps {
  status: KernelStatus
  onRunTests?: () => void
  onRunFile: () => void
  onDownloadFile: () => void
  onDownloadZip: () => void
  onBackToUnits?: () => void
}

const STATUS_LABEL: Record<KernelStatus, string> = {
  starting: 'Starting Octave…',
  ready: 'Ready',
  running: 'Running…',
  error: 'Error',
}

const STATUS_DOT: Record<KernelStatus, string> = {
  starting: 'bg-slate-500',
  ready: 'bg-cyan-400',
  running: 'bg-cyan-400 animate-pulse',
  error: 'bg-red-400',
}

export function Toolbar({
  status,
  onRunTests,
  onRunFile,
  onDownloadFile,
  onDownloadZip,
  onBackToUnits,
}: ToolbarProps) {
  const busy = status === 'starting' || status === 'running'
  return (
    <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-900 px-3 py-2">
      {onBackToUnits && (
        <button
          className="rounded px-2 py-1 text-sm text-slate-400 hover:bg-slate-800 hover:text-slate-100"
          onClick={onBackToUnits}
        >
          ← All units
        </button>
      )}
      {onRunTests && (
        <button
          className="rounded bg-cyan-600 px-3 py-1 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-40"
          disabled={busy}
          onClick={onRunTests}
        >
          Run Tests
        </button>
      )}
      <button
        className="rounded bg-cyan-600 px-3 py-1 text-sm font-medium text-white hover:bg-cyan-500 disabled:opacity-40"
        disabled={busy}
        onClick={onRunFile}
      >
        Run File
      </button>
      <div className="mx-1 h-5 w-px bg-slate-700" />
      <button
        className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
        onClick={onDownloadFile}
        title="Download the current file"
      >
        Download File
      </button>
      <button
        className="rounded border border-slate-700 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
        onClick={onDownloadZip}
        title="Download all files as a zip, for Canvas submission"
      >
        Download All (.zip)
      </button>
      <span className="ml-auto flex items-center gap-1.5 text-xs text-slate-400">
        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
        <span className={status === 'error' ? 'text-red-400' : undefined}>
          {STATUS_LABEL[status]}
        </span>
      </span>
    </div>
  )
}
