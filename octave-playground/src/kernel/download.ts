// T3.2: hand the student the exact bytes the kernel ran, no packaging step.
// Both functions read straight from the live in-memory editor buffer
// (Playground's `contents` state), not the browser-persisted drive, so
// there's no dependency on the autosave debounce having already fired.
import JSZip from 'jszip'

function triggerDownload(blob: Blob, filename: string): void {
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

/** Zips files flat (no folders) -- matches the local Octave mental model:
 *  one unit's .m files sitting together in a single working directory.
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
): Promise<void> {
  const zip = new JSZip()
  const excluded = new Set(exclude)
  for (const [name, content] of Object.entries(files)) {
    if (excluded.has(name)) continue
    zip.file(name, content)
  }
  const blob = await zip.generateAsync({ type: 'blob' })
  triggerDownload(blob, `${unitId}.zip`)
}
