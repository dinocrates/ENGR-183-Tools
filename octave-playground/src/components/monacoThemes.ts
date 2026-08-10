import type { Monaco } from '@monaco-editor/react'

// Unlike dark/light/high-contrast (Editor.tsx's MONACO_THEME lookup), Monaco
// ships no built-in equivalent for either of these -- each needs a real
// monaco.editor.defineTheme call. base: 'vs-dark', inherit: true means only
// the background/foreground/token colors below are overridden, not a full
// redefinition of every editor chrome color the way hc-black/hc-light do it
// (see octaveLanguage.ts's registerOctaveLanguage for that pattern; this one
// doesn't need it since we're not shipping our own base theme, just tinting
// an existing one). Token names (comment/keyword/string/number) match what
// octaveLanguage.ts's tokenizer actually emits.

let registered = false

/** Idempotent for the same reason registerOctaveLanguage is -- Editor.tsx's
 *  beforeMount fires on every mount (every unit switch). */
export function registerCustomMonacoThemes(monaco: Monaco): void {
  if (registered) return
  registered = true

  monaco.editor.defineTheme('matrix', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '145c26' },
      { token: 'keyword', foreground: '00ff41', fontStyle: 'bold' },
      { token: 'string', foreground: '66ff99' },
      { token: 'number', foreground: '99ffcc' },
      { token: 'operator', foreground: '33cc55' },
      { token: 'delimiter', foreground: '33cc55' },
    ],
    colors: {
      'editor.background': '#000000',
      'editor.foreground': '#33cc55',
      'editorCursor.foreground': '#00ff41',
      'editorLineNumber.foreground': '#145c26',
      'editorLineNumber.activeForeground': '#00ff41',
    },
  })

  monaco.editor.defineTheme('nes-retro', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'comment', foreground: '9494cc' },
      { token: 'keyword', foreground: '3498ff', fontStyle: 'bold' },
      { token: 'string', foreground: 'ffd700' },
      { token: 'number', foreground: 'e63958' },
      { token: 'operator', foreground: 'd4d4ff' },
      { token: 'delimiter', foreground: 'd4d4ff' },
    ],
    colors: {
      'editor.background': '#0d0d2b',
      'editor.foreground': '#ffffff',
      'editorCursor.foreground': '#3498ff',
      'editorLineNumber.foreground': '#6b6b99',
      'editorLineNumber.activeForeground': '#3498ff',
    },
  })
}
