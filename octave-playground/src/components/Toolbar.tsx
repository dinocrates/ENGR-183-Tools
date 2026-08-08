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
    <div className="flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-3 py-2">
      {onBackToUnits && (
        <button
          className="rounded px-2 py-1 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100"
          onClick={onBackToUnits}
        >
          ← All units
        </button>
      )}
      {onRunTests && (
        <button
          className="rounded bg-neutral-700 px-3 py-1 text-sm text-neutral-100 disabled:opacity-40"
          disabled={busy}
          onClick={onRunTests}
        >
          Run Tests
        </button>
      )}
      <button
        className="rounded bg-neutral-700 px-3 py-1 text-sm text-neutral-100 disabled:opacity-40"
        disabled={busy}
        onClick={onRunFile}
      >
        Run File
      </button>
      <div className="mx-1 h-5 w-px bg-neutral-800" />
      <button
        className="rounded border border-neutral-700 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-800"
        onClick={onDownloadFile}
        title="Download the current file"
      >
        Download File
      </button>
      <button
        className="rounded border border-neutral-700 px-3 py-1 text-sm text-neutral-300 hover:bg-neutral-800"
        onClick={onDownloadZip}
        title="Download all files as a zip, for Canvas submission"
      >
        Download All (.zip)
      </button>
      <span
        className={`ml-auto text-xs ${status === 'error' ? 'text-red-400' : 'text-neutral-400'}`}
      >
        {STATUS_LABEL[status]}
      </span>
    </div>
  )
}
