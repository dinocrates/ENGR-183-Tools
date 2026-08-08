interface PanelHeaderProps {
  title: string
  collapsed: boolean
  onToggleCollapse: () => void
}

// Shared header for File Browser/Workspace/Command Window: title + a
// collapse button reusing the same minimize/expand glyph convention as
// FloatingFigure's title bar, so the interaction feels the same everywhere.
// flex-shrink-0 matters: when the parent Panel is squeezed down to its
// collapsedSize, this header is what stays visible (the rest of the panel's
// content shrinks/clips away) -- it's the only way back to expanded once
// collapsed via drag rather than the button.
export function PanelHeader({ title, collapsed, onToggleCollapse }: PanelHeaderProps) {
  return (
    <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-700 px-3 py-1.5">
      <span className="text-xs font-semibold text-slate-400">{title}</span>
      <button
        className="rounded px-1.5 text-xs text-slate-500 hover:bg-slate-800 hover:text-slate-300"
        onClick={onToggleCollapse}
        title={collapsed ? `Expand ${title}` : `Collapse ${title}`}
      >
        {collapsed ? '▢' : '─'}
      </button>
    </div>
  )
}
