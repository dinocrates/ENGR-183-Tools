interface FontSizeControlsProps {
  size: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
}

// "Big A / little A" text-size stepper -- built for recording instructor
// videos, where zooming the whole browser also blows up the toolbar/panel
// chrome, not just the code/output text. Two buttons rather than a slider:
// cheap to hit precisely mid-recording, and the current size stays visible
// between them so it's obvious at a glance while narrating.
export function FontSizeControls({ size, onChange, min = 10, max = 32, step = 1 }: FontSizeControlsProps) {
  return (
    <div className="flex items-center gap-1">
      <button
        className="rounded px-1.5 py-0.5 leading-none text-muted hover:bg-raised hover:text-secondary disabled:opacity-30"
        onClick={() => onChange(Math.max(min, size - step))}
        disabled={size <= min}
        title="Decrease text size"
      >
        <span className="text-[10px] font-semibold">A</span>
      </button>
      <span className="w-8 text-center text-[10px] tabular-nums text-faint">{size}px</span>
      <button
        className="rounded px-1.5 py-0.5 leading-none text-muted hover:bg-raised hover:text-secondary disabled:opacity-30"
        onClick={() => onChange(Math.min(max, size + step))}
        disabled={size >= max}
        title="Increase text size"
      >
        <span className="text-base font-semibold">A</span>
      </button>
    </div>
  )
}
