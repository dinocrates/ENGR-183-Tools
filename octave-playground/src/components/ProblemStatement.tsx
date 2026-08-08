import { useState } from 'react'

interface ProblemStatementProps {
  title: string
  description: string
}

export function ProblemStatement({ title, description }: ProblemStatementProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="border-b border-slate-700 bg-slate-900">
      <button
        className="flex w-full items-center justify-between px-3 py-1.5 text-left"
        onClick={() => setCollapsed((c) => !c)}
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-semibold text-slate-100">{title}</span>
        <span className="text-xs text-cyan-400">{collapsed ? 'Show' : 'Hide'}</span>
      </button>
      {!collapsed && <p className="px-3 pb-3 text-sm leading-relaxed text-slate-300">{description}</p>}
    </div>
  )
}
