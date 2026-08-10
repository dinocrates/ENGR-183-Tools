import { useState } from 'react'

interface ProblemStatementProps {
  title: string
  description: string
}

export function ProblemStatement({ title, description }: ProblemStatementProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="border-b border-line bg-surface">
      <button
        className="flex w-full items-center justify-between px-3 py-1.5 text-left"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-semibold text-primary">{title}</span>
        <span className="text-xs text-accent-fg">{collapsed ? 'Show' : 'Hide'}</span>
      </button>
      {!collapsed && <p className="px-3 pb-3 text-sm leading-relaxed text-secondary">{description}</p>}
    </div>
  )
}
