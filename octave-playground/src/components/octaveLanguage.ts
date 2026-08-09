import type { Monaco } from '@monaco-editor/react'

// Monaco's bundled basic-languages no longer include MATLAB (confirmed by
// checking node_modules/monaco-editor/esm/vs/basic-languages/monaco.contribution.js
// directly -- it isn't in the ~65 registered languages), so `language="matlab"`
// silently fell back to plaintext with zero highlighting. This registers a
// real Octave tokenizer instead of leaning on a language that doesn't exist
// in this build.
export const OCTAVE_LANGUAGE_ID = 'octave'

const KEYWORDS = [
  'function', 'endfunction',
  'if', 'elseif', 'else', 'endif',
  'for', 'endfor', 'parfor', 'endparfor',
  'while', 'endwhile', 'do', 'until',
  'switch', 'case', 'otherwise', 'endswitch',
  'try', 'catch', 'end_try_catch',
  'unwind_protect', 'unwind_protect_cleanup', 'end_unwind_protect',
  'break', 'continue', 'return',
  'global', 'persistent',
  'classdef', 'endclassdef', 'properties', 'endproperties',
  'methods', 'endmethods', 'events', 'endevents',
  'enumeration', 'endenumeration',
  'end',
]

const CONSTANTS = ['true', 'false', 'pi', 'Inf', 'inf', 'NaN', 'nan', 'NA', 'eps']

const OPERATORS = [
  '+', '-', '*', '/', '\\', '^',
  '.*', './', '.\\', '.^',
  '==', '~=', '!=', '<', '>', '<=', '>=',
  '&&', '||', '&', '|',
  '=', '+=', '-=', '*=', '/=',
  ':', '!', '~',
]

let registered = false

/** Idempotent -- Editor.tsx's beforeMount fires on every mount (e.g. every
 *  unit switch, since Playground remounts per unit -- App.tsx's key={unit.id}),
 *  but only the first call needs to actually register anything. */
export function registerOctaveLanguage(monaco: Monaco): void {
  if (registered) return
  registered = true

  monaco.languages.register({ id: OCTAVE_LANGUAGE_ID })

  monaco.languages.setLanguageConfiguration(OCTAVE_LANGUAGE_ID, {
    comments: { lineComment: '%', blockComment: ['%{', '%}'] },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: "'", close: "'" },
      { open: '"', close: '"' },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: "'", close: "'" },
      { open: '"', close: '"' },
    ],
  })

  monaco.languages.setMonarchTokensProvider(OCTAVE_LANGUAGE_ID, {
    defaultToken: '',
    keywords: KEYWORDS,
    constants: CONSTANTS,
    operators: OPERATORS,
    // No `'` here, deliberately -- see the transpose-vs-string-start note below.
    symbols: /[=><!~?:&|+\-*\/\^.]+/,

    tokenizer: {
      root: [
        // Block comments only recognized on their own line (real Octave
        // syntax) -- checked via Monarch's own start-of-LINE anchor (a
        // literal leading `^` in the pattern source, not just "start of
        // the remaining substring": confirmed in monarchLexer.js, which
        // special-cases patterns of the form `^(?:...)` for its
        // matchOnlyAtLineStart optimization).
        [/^\s*%\{\s*$/, { token: 'comment', next: '@blockComment' }],
        [/^\s*#\{\s*$/, { token: 'comment', next: '@blockComment' }],

        [/%.*$/, 'comment'],
        [/#.*$/, 'comment'],
        [/\.\.\..*$/, 'comment'], // line continuation, rest of line is ignored

        { include: '@whitespace' },

        // Octave's `'` is both the string-quote and the transpose operator
        // (`A'`), disambiguated only by adjacency: immediately after an
        // identifier/closing-bracket with no space, it's transpose. Monaco's
        // Monarch engine matches against line.substr(pos) at each step (not
        // the full line with a sticky regex), so a lookbehind assertion
        // can't see characters before the current match -- confirmed by
        // reading monarchLexer.js directly rather than assuming. Instead,
        // each of these consumes the identifier/bracket/dot AND any
        // trailing quote(s) in the same match, splitting the result into
        // two tokens via Monarch's multi-capture-group action array. A `'`
        // that doesn't immediately follow one of these (e.g. after
        // whitespace) falls through to the plain string-start rule below,
        // matching how most editors approximate this ambiguity.
        [/([A-Za-z_]\w*)('*)/, [
          { cases: { '@keywords': 'keyword', '@constants': 'constant', '@default': 'identifier' } },
          'operator',
        ]],
        [/([)\]}])('*)/, ['@brackets', 'operator']],
        [/\.'+/, 'operator'], // non-conjugate transpose (A.'), unambiguous

        [/'/, { token: 'string.quote', next: '@sqstring' }],
        [/"/, { token: 'string.quote', next: '@dqstring' }],

        [/\d+\.\d*([eE][+-]?\d+)?[ij]?/, 'number.float'],
        [/\.\d+([eE][+-]?\d+)?[ij]?/, 'number.float'],
        [/0[xX][0-9a-fA-F]+/, 'number.hex'],
        [/0[bB][01]+/, 'number.binary'],
        [/\d+([eE][+-]?\d+)?[ij]?/, 'number'],

        [/[{}()\[\]]/, '@brackets'],
        [/[,;]/, 'delimiter'],

        [/@symbols/, { cases: { '@operators': 'operator', '@default': '' } }],
      ],

      whitespace: [
        [/[ \t\r\n]+/, ''],
      ],

      blockComment: [
        [/^\s*[%#]\}\s*$/, { token: 'comment', next: '@pop' }],
        [/.*$/, 'comment'],
      ],

      sqstring: [
        [/''/, 'string'], // '' inside a single-quoted string is a literal quote
        [/[^']+/, 'string'],
        [/'/, { token: 'string.quote', next: '@pop' }],
      ],

      dqstring: [
        [/\\./, 'string.escape'],
        [/[^\\"]+/, 'string'],
        [/"/, { token: 'string.quote', next: '@pop' }],
      ],
    },
  })
}
