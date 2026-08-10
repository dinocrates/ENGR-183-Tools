export type KernelStatus = 'starting' | 'ready' | 'running' | 'error'

interface ToolbarProps {
  status: KernelStatus
  onRunTests?: () => void
  onRunFile: () => void
  onDownloadFile: () => void
  onDownloadZip: () => void
  onResetFile: () => void
  onResetUnit: () => void
  onBackToUnits?: () => void
  // False for a student-added file, which has no starter to reset to.
  canResetFile: boolean
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
  onResetFile,
  onResetUnit,
  onBackToUnits,
  canResetFile,
}: ToolbarProps) {
  const busy = status === 'starting' || status === 'running'
  return (
    <div className="flex items-center gap-2 border-b border-line bg-surface px-3 py-2">
      {onBackToUnits && (
        <button
          className="rounded px-2 py-1 text-sm text-muted hover:bg-raised hover:text-primary"
          onClick={onBackToUnits}
        >
          ← All units
        </button>
      )}
      {onRunTests && (
        <button
          className="rounded bg-accent px-3 py-1 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
          disabled={busy}
          onClick={onRunTests}
        >
          Run Tests
        </button>
      )}
      <button
        className="rounded bg-accent px-3 py-1 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-40"
        disabled={busy}
        onClick={onRunFile}
      >
        Run File
      </button>
      <div className="mx-1 h-5 w-px bg-line" />
      <button
        className="rounded border border-line px-3 py-1 text-sm text-secondary hover:bg-raised"
        onClick={onDownloadFile}
        title="Download the current file"
      >
        Download File
      </button>
      <button
        className="rounded border border-line px-3 py-1 text-sm text-secondary hover:bg-raised"
        onClick={onDownloadZip}
        title="Download all files as a zip, for Canvas submission"
      >
        Download All (.zip)
      </button>
      <div className="mx-1 h-5 w-px bg-line" />
      <button
        className="rounded border border-line px-3 py-1 text-sm text-secondary hover:bg-raised disabled:opacity-40"
        disabled={busy || !canResetFile}
        onClick={onResetFile}
        title={
          canResetFile
            ? 'Discard changes to the current file, restoring the original starter'
            : "This file has no starter to reset to -- it was added, not part of the unit"
        }
      >
        Reset File
      </button>
      <button
        className="rounded px-2 py-1 text-xs text-muted hover:bg-raised hover:text-secondary disabled:opacity-40"
        disabled={busy}
        onClick={onResetUnit}
        title="Discard changes to every file in this unit, restoring the original starters"
      >
        Reset unit
      </button>
      <span className="ml-auto flex items-center gap-1.5 text-xs text-muted">
        <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status]}`} />
        <span className={status === 'error' ? 'text-danger-fg' : undefined}>
          {STATUS_LABEL[status]}
        </span>
      </span>
    </div>
  )
}
