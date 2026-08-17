import { useState } from 'react'

interface ProblemStatementProps {
  title: string
  description: string
  // Both optional and additive -- omitted entirely for units that don't
  // set them (e.g. Unit 1/2's assignments), so this never changes their
  // rendered output.
  note?: string
  sourceUrl?: string
}

export function ProblemStatement({ title, description, note, sourceUrl }: ProblemStatementProps) {
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
      {!collapsed && (
        <div className="px-3 pb-3">
          <p className="text-sm leading-relaxed text-secondary">{description}</p>
          {note && <p className="mt-2 text-xs leading-relaxed text-muted">{note}</p>}
          {sourceUrl && (
            <p className="mt-1 text-xs">
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent-fg underline hover:no-underline"
              >
                Data source
              </a>
            </p>
          )}
        </div>
      )}
    </div>
  )
}
