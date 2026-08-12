// Multi-line block detection for the Command Window's interactive prompt.
// Not a real Octave parser -- just enough to answer "is this a complete,
// executable unit yet, or should the prompt keep buffering more lines."

const BLOCK_OPENERS = new Set(['for', 'parfor', 'while', 'if', 'switch', 'function', 'do', 'try'])
const BLOCK_CLOSERS = new Set([
  'end',
  'endfor',
  'endparfor',
  'endwhile',
  'endif',
  'endswitch',
  'endfunction',
  'until',
  'end_try_catch',
])

/** Blanks out string-literal contents and strips line comments so the
 *  keyword/bracket scan in isBlockComplete isn't confused by text inside
 *  them (e.g. disp('the end (of story)'), % for reference). Handles
 *  Octave's '' / "" doubled-quote escape convention and backslash escapes
 *  inside double-quoted strings. Not a full lexer -- block comments
 *  (%{ ... %}) aren't specially handled, an accepted gap given how rarely
 *  those show up in a one-off typed command. */
export function stripStringsAndComments(code: string): string {
  let out = ''
  let i = 0
  const n = code.length
  while (i < n) {
    const c = code[i]
    if (c === '%' || c === '#') {
      while (i < n && code[i] !== '\n') i++
      continue
    }
    if (c === "'" || c === '"') {
      const quote = c
      out += ' '
      i++
      while (i < n) {
        if (code[i] === '\\' && quote === '"') {
          i += 2
          continue
        }
        if (code[i] === quote) {
          if (code[i + 1] === quote) {
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      continue
    }
    out += c
    i++
  }
  return out
}

/** True once every opened block keyword has a matching closer and every
 *  opened bracket/paren/brace is closed. Bracket depth gates the `end`
 *  keyword specifically: `end` is also the last-element array index
 *  (`x(end)`, `A(1:end,:)`), which only ever appears inside an open
 *  bracket -- so a bare `end` only counts as a block-closer when
 *  bracketDepth is 0. That's what disambiguates the two without needing a
 *  real parser. */
export function isBlockComplete(code: string): boolean {
  const stripped = stripStringsAndComments(code)
  let blockDepth = 0
  let bracketDepth = 0
  const tokens = stripped.match(/\b[a-zA-Z_]\w*\b|[()[\]{}]/g) ?? []
  for (const token of tokens) {
    if (token === '(' || token === '[' || token === '{') {
      bracketDepth++
    } else if (token === ')' || token === ']' || token === '}') {
      bracketDepth = Math.max(0, bracketDepth - 1)
    } else {
      const lower = token.toLowerCase()
      if (BLOCK_OPENERS.has(lower)) {
        blockDepth++
      } else if (BLOCK_CLOSERS.has(lower) && bracketDepth === 0) {
        blockDepth = Math.max(0, blockDepth - 1)
      }
    }
  }
  return blockDepth <= 0 && bracketDepth <= 0
}

/** Formats a (possibly multi-line) command the way it should read once
 *  echoed: first line gets the `>>` prompt, every continuation line gets
 *  `..`, matching the prompt CommandWindow.tsx shows while it's still
 *  buffering that same line. */
export function formatReplEcho(code: string): string {
  return code
    .split('\n')
    .map((line, i) => (i === 0 ? `>> ${line}` : `.. ${line}`))
    .join('\n')
}
