interface StartupOverlayProps {
  error: string | null
}

export function StartupOverlay({ error }: StartupOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-app/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg border border-line bg-surface p-6 text-center shadow-2xl shadow-black/50">
        {error ? (
          <>
            <div className="mb-2 text-sm font-semibold text-danger-fg">Octave didn't start</div>
            <p className="mb-4 text-xs text-muted">{error}</p>
            <button
              className="rounded bg-accent px-3 py-1.5 text-sm font-medium text-on-accent hover:bg-accent-hover"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </>
        ) : (
          <>
            <div className="mb-3 text-sm font-semibold text-primary">Starting Octave…</div>
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-raised">
              <div className="h-full w-1/3 animate-[loading-bar_1.2s_ease-in-out_infinite] rounded-full bg-cyan-400" />
            </div>
            <p className="text-xs text-muted">
              This can take up to a minute on your first visit — Octave is loading right in
              your browser, not on a server. It's much faster after that.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
