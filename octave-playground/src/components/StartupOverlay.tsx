interface StartupOverlayProps {
  error: string | null
}

export function StartupOverlay({ error }: StartupOverlayProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg border border-neutral-700 bg-neutral-900 p-6 text-center shadow-xl">
        {error ? (
          <>
            <div className="mb-2 text-sm font-semibold text-red-400">Octave didn't start</div>
            <p className="mb-4 text-xs text-neutral-400">{error}</p>
            <button
              className="rounded bg-neutral-700 px-3 py-1.5 text-sm text-neutral-100 hover:bg-neutral-600"
              onClick={() => window.location.reload()}
            >
              Reload page
            </button>
          </>
        ) : (
          <>
            <div className="mb-3 text-sm font-semibold text-neutral-100">Starting Octave…</div>
            <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full w-1/3 animate-[loading-bar_1.2s_ease-in-out_infinite] rounded-full bg-cyan-500" />
            </div>
            <p className="text-xs text-neutral-400">
              This can take up to a minute on your first visit — Octave is loading right in
              your browser, not on a server. It's much faster after that.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
