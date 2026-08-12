import { useRef, useState } from 'react'
import { PlotOutput } from './PlotOutput'

interface FloatingFigureProps {
  id: string
  label: string
  mimeBundle: Record<string, unknown>
  // Set once the run that would have populated this figure has settled with
  // no data ever arriving -- a real, intermittent kernel bug (DESIGN.md
  // T3.21), not a rendering-in-progress state. See PlotOutput.tsx.
  failed?: boolean
  initialPosition: { x: number; y: number }
  zIndex: number
  onClose: (id: string) => void
  onFocus: (id: string) => void
}

const DEFAULT_SIZE = { width: 560, height: 420 }
const MIN_SIZE = { width: 320, height: 220 }

// Desktop Octave opens each plot in its own floating Figure window, separate
// from the Command Window -- not inline in the console text stream. This is
// the browser equivalent: draggable by its title bar, closable, resizable,
// minimizable, cascaded so multiple figures from one run don't stack exactly
// on top of each other.
export function FloatingFigure({
  id,
  label,
  mimeBundle,
  failed,
  initialPosition,
  zIndex,
  onClose,
  onFocus,
}: FloatingFigureProps) {
  const [position, setPosition] = useState(initialPosition)
  const [size, setSize] = useState(DEFAULT_SIZE)
  const [liveSize, setLiveSize] = useState<typeof DEFAULT_SIZE | null>(null)
  const [minimized, setMinimized] = useState(false)
  const dragState = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null)
  const resizeState = useRef<{ startX: number; startY: number; startWidth: number; startHeight: number } | null>(null)

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

  // The window itself resizes live (cheap: just CSS) as the handle is
  // dragged, but the plot inside only redraws once, when the drag ends --
  // Plotly.newPlot() is a full purge-and-rebuild (PlotOutput.tsx), and firing
  // that on every mousemove would be janky at best and risks reintroducing
  // the render-ordering bugs already found and fixed once (see PlotOutput.tsx's
  // own comments on that history).
  function handleResizeStart(e: React.MouseEvent) {
    e.stopPropagation()
    onFocus(id)
    resizeState.current = { startX: e.clientX, startY: e.clientY, startWidth: size.width, startHeight: size.height }
    window.addEventListener('mousemove', handleResizeMove)
    window.addEventListener('mouseup', handleResizeEnd)
  }

  function handleResizeMove(e: MouseEvent) {
    const r = resizeState.current
    if (!r) return
    setLiveSize({
      width: Math.max(MIN_SIZE.width, r.startWidth + (e.clientX - r.startX)),
      height: Math.max(MIN_SIZE.height, r.startHeight + (e.clientY - r.startY)),
    })
  }

  function handleResizeEnd() {
    setLiveSize((live) => {
      if (live) setSize(live)
      return null
    })
    resizeState.current = null
    window.removeEventListener('mousemove', handleResizeMove)
    window.removeEventListener('mouseup', handleResizeEnd)
  }

  const displayWidth = liveSize?.width ?? size.width
  const displayHeight = liveSize?.height ?? size.height

  return (
    <div
      className="absolute flex flex-col overflow-hidden rounded-md border border-line bg-surface shadow-2xl shadow-black/50"
      style={{ left: position.x, top: position.y, width: displayWidth, zIndex }}
      onMouseDown={() => onFocus(id)}
    >
      <div
        className="flex cursor-move items-center justify-between border-b border-line bg-raised px-3 py-1.5 select-none"
        onMouseDown={handleDragStart}
      >
        <span className="text-xs font-semibold text-secondary">{label}</span>
        <div className="flex items-center gap-1">
          <button
            className="rounded px-1.5 text-xs text-muted hover:bg-line hover:text-primary"
            onClick={(e) => {
              e.stopPropagation()
              setMinimized((m) => !m)
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title={minimized ? 'Expand figure' : 'Minimize figure'}
          >
            {minimized ? '▢' : '─'}
          </button>
          <button
            className="rounded px-1.5 text-xs text-muted hover:bg-line hover:text-primary"
            onClick={(e) => {
              e.stopPropagation()
              onClose(id)
            }}
            onMouseDown={(e) => e.stopPropagation()}
            title="Close figure"
          >
            ✕
          </button>
        </div>
      </div>
      {!minimized && (
        // Real Octave/MATLAB figures render on white regardless of app theme
        // -- no padding here so the plot's own white background goes edge to
        // edge, like an actual Figure window's canvas.
        <div className="relative bg-white" style={{ height: displayHeight }}>
          <PlotOutput mimeBundle={mimeBundle} failed={failed} width={size.width} height={size.height} />
          <div
            className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize text-muted"
            onMouseDown={handleResizeStart}
            title="Resize"
          >
            <svg viewBox="0 0 16 16" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M14 2 L2 14 M14 7 L7 14 M14 12 L12 14" />
            </svg>
          </div>
        </div>
      )}
    </div>
  )
}
