interface PersistenceWarningProps {
  onAcknowledge: () => void
}

// R5: IndexedDB is not durable -- clearing browser data destroys student
// work. Mitigated by prominent export (T3.2's Download File/Download All),
// never by promising persistence. Shown once per browser (App.tsx tracks
// acknowledgment in localStorage), before a student can invest any work --
// not dismissable by clicking outside or pressing Escape, only by reading
// and clicking through it.
export function PersistenceWarning({ onAcknowledge }: PersistenceWarningProps) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-app/85 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-line bg-surface p-6 shadow-2xl shadow-black/50">
        <div className="mb-2 text-sm font-semibold text-primary">
          Before you start: your work lives in this browser
        </div>
        <p className="mb-2 text-xs leading-relaxed text-muted">
          Files you edit here are saved in this browser's local storage, not on a
          server. Clearing your browser data, or switching to a different browser
          or computer, will lose anything you haven't downloaded.
        </p>
        <p className="mb-5 text-xs leading-relaxed text-muted">
          Use <span className="text-secondary">Download File</span> or{' '}
          <span className="text-secondary">Download All (.zip)</span> in the
          toolbar to save your own copy — the same files you'll submit to Canvas.
        </p>
        <div className="flex justify-end">
          <button
            className="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
            onClick={onAcknowledge}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  )
}
