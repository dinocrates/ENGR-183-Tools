interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

// Reusable themed confirm modal -- T3.3's reset actions are destructive
// (overwrite unsaved work with the starter), so they get an explicit,
// named-consequence confirmation step rather than acting immediately.
export function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-black/50">
        <div className="mb-2 text-sm font-semibold text-slate-100">{title}</div>
        <p className="mb-5 text-xs text-slate-400">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            className="rounded px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-800"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
