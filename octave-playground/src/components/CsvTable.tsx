import { useMemo, useRef, useState } from 'react'
import { parseCsv } from './csv'

interface CsvTableProps {
  filename: string
  content: string
  fontSize: number
  headerOverride?: boolean
  onHeaderChange: (hasHeader: boolean) => void
}

const ROWS_PER_PAGE = 200
const buttonClass = 'rounded border border-line px-2 py-1 text-secondary hover:bg-raised disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-accent-fg'

export function CsvTable({ filename, content, fontSize, headerOverride, onHeaderChange }: CsvTableProps) {
  const csv = useMemo(() => parseCsv(content), [content])
  const [page, setPage] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const hasHeader = headerOverride ?? csv.hasHeader
  const offset = hasHeader ? 1 : 0
  const rowCount = Math.max(0, csv.rows.length - offset)
  const pageCount = Math.max(1, Math.ceil(rowCount / ROWS_PER_PAGE))
  const currentPage = Math.min(page, pageCount - 1)
  const start = currentPage * ROWS_PER_PAGE
  const columns = Array.from({ length: csv.columnCount }, (_, index) => index)

  function changePage(next: number) {
    setPage(next)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  if (csv.error) {
    return (
      <div role="status" className="p-4 text-sm text-secondary">
        <p>Table view is unavailable: {csv.error}</p>
        <p className="mt-2">Switch to Raw to view the file.</p>
      </div>
    )
  }
  if (csv.rows.length === 0) {
    return <p role="status" className="p-4 text-sm text-muted">This CSV file is empty.</p>
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-app">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-surface px-3 py-1.5 text-xs text-muted">
        <span>{rowCount.toLocaleString()} {rowCount === 1 ? 'row' : 'rows'} · {csv.columnCount} {csv.columnCount === 1 ? 'column' : 'columns'} · Read-only</span>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-secondary">
          <input
            type="checkbox"
            className="accent-accent"
            checked={hasHeader}
            onChange={event => {
              onHeaderChange(event.target.checked)
              changePage(0)
            }}
          />
          First row is headers
        </label>
      </div>
      <div
        ref={scrollRef}
        role="region"
        aria-label={`${filename} table`}
        tabIndex={0}
        className="min-h-0 min-w-0 flex-1 overflow-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent-fg"
        style={{ fontSize }}
      >
        <table aria-label={filename} className="w-full border-separate border-spacing-0 text-left font-mono tabular-nums">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 top-0 z-20 border-b border-r border-line bg-surface px-3 py-2 text-right font-normal text-muted" title="Data row number">
                <span aria-hidden="true">#</span><span className="sr-only">Row</span>
              </th>
              {columns.map(column => (
                <th key={column} scope="col" className="sticky top-0 z-10 whitespace-pre border-b border-r border-line bg-surface px-3 py-2 font-semibold text-primary">
                  {hasHeader && csv.rows[0][column]?.trim() ? csv.rows[0][column] : `Column ${column + 1}`}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {csv.rows.slice(start + offset, start + offset + ROWS_PER_PAGE).map((row, index) => (
              <tr key={start + index} className="even:bg-surface hover:bg-raised">
                <th scope="row" className="sticky left-0 z-10 border-b border-r border-line bg-surface px-3 py-1.5 text-right font-normal text-muted">{start + index + 1}</th>
                {columns.map(column => (
                  <td key={column} className="whitespace-pre border-b border-r border-line-subtle px-3 py-1.5 text-secondary">{row[column] ?? ''}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pageCount > 1 && (
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-line bg-surface px-3 py-1.5 text-xs text-muted">
          <span role="status">Rows {start + 1}–{Math.min(start + ROWS_PER_PAGE, rowCount)} of {rowCount.toLocaleString()}</span>
          <button type="button" className={buttonClass} disabled={currentPage === 0} onClick={() => changePage(currentPage - 1)}>Previous rows</button>
          <button type="button" className={buttonClass} disabled={currentPage + 1 === pageCount} onClick={() => changePage(currentPage + 1)}>Next rows</button>
        </div>
      )}
    </div>
  )
}
