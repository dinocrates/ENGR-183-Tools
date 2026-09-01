import type { DebugFrame } from '../kernel/debug'

interface DebugBarProps {
  frame: DebugFrame
  stack: DebugFrame[]
  onContinue: () => void
  onStepOver: () => void
  onStepInto: () => void
  onStepOut: () => void
  onStop: () => void
}

function shortFile(file: string): string {
  const base = file.split('/').pop() ?? file
  return base.replace(/\.m$/, '')
}

export function DebugBar({
  frame,
  stack,
  onContinue,
  onStepOver,
  onStepInto,
  onStepOut,
  onStop,
}: DebugBarProps) {
  const btn =
    'rounded border border-line bg-app px-2 py-1 text-xs text-secondary hover:bg-raised hover:text-primary'
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-accent/40 bg-accent/10 px-3 py-1.5">
      <span className="text-xs font-medium text-accent-fg">Paused</span>
      <code className="text-xs text-primary">
        {shortFile(frame.file)}:{frame.line}
      </code>
      <div className="mx-1 h-4 w-px bg-line" />
      <button className={btn} onClick={onContinue} title="Continue (run to the next breakpoint)">
        ▶ Continue
      </button>
      <button className={btn} onClick={onStepOver} title="Step over this line">
        ↷ Step
      </button>
      <button className={btn} onClick={onStepInto} title="Step into a function call on this line">
        ↓ Into
      </button>
      <button className={btn} onClick={onStepOut} title="Run to the end of the current function">
        ↑ Out
      </button>
      <button
        className="rounded border border-danger/50 px-2 py-1 text-xs text-danger-fg hover:bg-danger/10"
        onClick={onStop}
        title="Stop debugging (abandons the run)"
      >
        ■ Stop
      </button>
      {stack.length > 1 && (
        <span className="ml-2 truncate text-xs text-muted">
          {stack.map((f) => `${shortFile(f.file)}:${f.line}`).join('  ←  ')}
        </span>
      )}
    </div>
  )
}
