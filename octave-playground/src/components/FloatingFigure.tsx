import { useRef, useState } from 'react'
import { PlotOutput } from './PlotOutput'

interface FloatingFigureProps {
  id: string
  label: string
  mimeBundle: Record<string, unknown>
  initialPosition: { x: number; y: number }
  zIndex: number
  onClose: (id: string) => void
  onFocus: (id: string) => void
}

// Desktop Octave opens each plot in its own floating Figure window, separate
// from the Command Window -- not inline in the console text stream. This is
// the browser equivalent: draggable by its title bar, closable, cascaded so
// multiple figures from one run don't stack exactly on top of each other.
export function FloatingFigure({
  id,
  label,
  mimeBundle,
  initialPosition,
  zIndex,
  onClose,
  onFocus,
}: FloatingFigureProps) {
  const [position, setPosition] = useState(initialPosition)
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)

  function handleDragStart(e: React.MouseEvent) {
    onFocus(id)
    dragState.current = { startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y }
    window.addEventListener('mousemove', handleDragMove)
    window.addEventListener('mouseup', handleDragEnd)
  }

  function handleDragMove(e: MouseEvent) {
    const drag = dragState.current
    if (!drag) return
    setPosition({
      x: drag.originX + (e.clientX - drag.startX),
      y: drag.originY + (e.clientY - drag.startY),
    })
  }

  function handleDragEnd() {
    dragState.current = null
    window.removeEventListener('mousemove', handleDragMove)
    window.removeEventListener('mouseup', handleDragEnd)
  }

  return (
    <div
      className="absolute flex w-[560px] flex-col overflow-hidden rounded-md border border-slate-700 bg-slate-900 shadow-2xl shadow-black/50"
      style={{ left: position.x, top: position.y, zIndex }}
      onMouseDown={() => onFocus(id)}
    >
      <div
        className="flex cursor-move items-center justify-between border-b border-slate-700 bg-slate-800 px-3 py-1.5 select-none"
        onMouseDown={handleDragStart}
      >
        <span className="text-xs font-semibold text-slate-200">{label}</span>
        <button
          className="rounded px-1.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-slate-100"
          onClick={() => onClose(id)}
          title="Close figure"
        >
          ✕
        </button>
      </div>
      {/* Real Octave/MATLAB figures render on white regardless of app theme
          -- no padding here so the plot's own white background goes edge to
          edge, like an actual Figure window's canvas. */}
      <div className="h-[420px] w-full bg-white">
        <PlotOutput mimeBundle={mimeBundle} width={560} height={420} />
      </div>
    </div>
  )
}
