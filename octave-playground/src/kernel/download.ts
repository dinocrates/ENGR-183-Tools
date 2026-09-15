// T3.2: hand the student the exact bytes the kernel ran, no packaging step.
// Both functions read straight from the live in-memory editor buffer
// (Playground's `contents` state), not the browser-persisted drive, so
// there's no dependency on the autosave debounce having already fired.
import JSZip from 'jszip'
import { figurePng } from './figureExport'
import { figureStem, serializeFigure, type SavedFigure } from './savedFigures'

export function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadFile(filename: string, content: string): void {
  triggerDownload(new Blob([content], { type: 'text/plain' }), filename)
}

/** Code/text files stay flat, matching Octave's working directory. Saved
 * figures travel as PNG/JSON pairs in a separate figures/ folder.
 *
 *  `exclude` (UnitMeta.submissionExclude) drops specific tabs from the
 *  zip's contents -- e.g. APA-03's supplied public-check script, which is
 *  part of the five-tab working project but must not appear in the
 *  four-file Canvas submission. Everything else about "download every
 *  tab" is unchanged for every unit that doesn't set it. */
export async function downloadZip(
  unitId: string,
  files: Record<string, string>,
  exclude: string[] = [],
  figures: SavedFigure[] = [],
): Promise<void> {
  const zip = new JSZip()
  const excluded = new Set(exclude)
  for (const [name, content] of Object.entries(files)) {
    if (excluded.has(name)) continue
    zip.file(name, content)
  }
  // Sequential exports keep memory bounded and ensure no ZIP is downloaded
  // with silently missing PNGs when one of the renders fails.
  for (const figure of figures) {
    if (excluded.has(figure.name) || (figure.sourceScript && excluded.has(figure.sourceScript))) continue
    zip.file(`figures/${figure.name}`, serializeFigure(figure))
    zip.file(`figures/${figureStem(figure.name)}.png`, await figurePng(figure.plot))
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, `${unitId}.zip`)
}
