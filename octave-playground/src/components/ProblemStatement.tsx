import { useState } from 'react'

interface ProblemStatementProps {
  title: string
  description: string
  // Both optional and additive -- omitted entirely for units that don't
  // set them (e.g. Unit 1/2's assignments), so this never changes their
  // rendered output.
  note?: string
  sourceUrl?: string
  // Bundled read-only data files for this unit. When present, a short
  // "how to open it" line is shown; absent/empty renders nothing.
  dataFiles?: string[]
}

export function ProblemStatement({
  title,
  description,
  note,
  sourceUrl,
  dataFiles = [],
}: ProblemStatementProps) {
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
          {dataFiles.length > 0 && (
            <div className="mt-2 rounded border border-line-subtle bg-app/50 px-2.5 py-2">
              <p className="text-xs font-semibold text-secondary">
                {dataFiles.length === 1 ? 'Data file' : 'Data files'} (read-only):
              </p>
              <ul className="mt-1 space-y-1">
                {dataFiles.map((file) => (
                  <li key={file} className="text-xs leading-relaxed text-muted">
                    <span className="text-secondary">🔒 {file}</span> — open it with{' '}
                    <code className="rounded bg-raised px-1 py-0.5 text-accent-fg">
                      engr183.data('{file}')
                    </code>
                    {/\.csv$/i.test(file) && (
                      <>
                        , e.g.{' '}
                        <code className="rounded bg-raised px-1 py-0.5 text-accent-fg">
                          csvread(engr183.data('{file}'))
                        </code>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
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
