export interface CsvData {
  rows: string[][]
  columnCount: number
  hasHeader: boolean
  error: string | null
}

function isNumeric(value: string): boolean {
  return value.trim() !== '' && (!Number.isNaN(Number(value)) || /^[+-]?(?:nan|inf(?:inity)?)$/i.test(value.trim()))
}

/** Parse display values without converting numbers, trimming cells, or changing the source. */
export function parseCsv(source: string): CsvData {
  const text = source.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let closedQuote = false
  let columnCount = 0

  function endField() {
    row.push(field)
    field = ''
    closedQuote = false
  }

  function endRow() {
    endField()
    columnCount = Math.max(columnCount, row.length)
    rows.push(row)
    row = []
  }

  function invalid(message: string): CsvData {
    return { rows: [], columnCount: 0, hasHeader: false, error: `${message} in CSV row ${rows.length + 1}.` }
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          quoted = false
          closedQuote = true
        }
      } else {
        field += char
      }
    } else if (char === ',') {
      endField()
    } else if (char === '\r' || char === '\n') {
      endRow()
      if (char === '\r' && text[i + 1] === '\n') i++
    } else if (closedQuote) {
      return invalid('Unexpected text after a closing quote')
    } else if (char === '"') {
      if (field !== '') return invalid('Unexpected quote in an unquoted field')
      quoted = true
    } else {
      field += char
    }
  }
  if (quoted) return invalid('Unclosed quoted field')
  // A final line ending terminates the preceding record; it is not another row.
  if (field !== '' || closedQuote || row.length > 0) endRow()

  const first = rows[0]
  // Conservative inference: text labels followed by numeric data. Text-only
  // files stay intact as data until the user explicitly selects a header row.
  const hasHeader = !!first && first.every(value => !isNumeric(value)) &&
    rows.slice(1, 11).some(values =>
      values.some((value, column) => first[column]?.trim() && isNumeric(value)),
    )
  return { rows, columnCount, hasHeader, error: null }
}
