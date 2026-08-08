import type { WorkspaceVar } from '../components/Workspace'

// Own temp names, cleared at the end so a later query in the same kernel
// session doesn't see them as leftover base-workspace variables.
export const WHOS_QUERY = [
  '__ws__ = whos();',
  'for __i__ = 1:numel(__ws__)',
  "  printf('%s|%s|%s\\n', __ws__(__i__).name, strtrim(mat2str(__ws__(__i__).size)), __ws__(__i__).class);",
  'end',
  'clear __ws__ __i__',
].join('\n')

function formatSize(matSize: string): string {
  // mat2str([1 100]) -> "[1 100]" -- reformat to Octave's own "1x100" style.
  return matSize
    .replace(/^\[|\]$/g, '')
    .trim()
    .split(/\s+/)
    .join('×')
}

export function parseWhosOutput(raw: string): WorkspaceVar[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, size, cls] = line.split('|')
      return { name: name ?? '', size: formatSize(size ?? ''), cls: cls ?? '' }
    })
    .filter((v) => v.name.length > 0)
}
