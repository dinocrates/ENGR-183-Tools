// Turns files a student drops on the File Browser (individual files, or a
// Download All .zip) into a list of items to merge into the current unit.
// All the "is this safe / what kind of file is this" decisions live here;
// Playground.tsx just applies the result to state and the drive.
import JSZip from 'jszip';
import {
  MAX_UPLOAD_BYTES,
  MAX_ZIP_ENTRIES,
  isEditableUpload,
  looksBinary,
  sanitizeUploadName,
} from './files';

export interface UploadedItem {
  /** Sanitized file name. */
  name: string;
  content: string;
  /** `.m` files become editable tabs; everything else is a read-only
   *  "My files" data file. */
  kind: 'editable' | 'data';
  /** Set when the name had to be sanitized, for the summary line. */
  renamedFrom?: string;
}

export interface UploadResult {
  items: UploadedItem[];
  skipped: { name: string; reason: string }[];
}

// Text formats an intro Octave course could plausibly ask a student to
// read. Anything else is skipped rather than written into the kernel.
const SUPPORTED_EXT = /\.(m|csv|txt|tsv|dat|json|log)$/i;

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function readAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('could not read file'));
    reader.readAsText(blob);
  });
}

function consider(rawName: string, text: string, out: UploadResult): void {
  const sanitized = sanitizeUploadName(rawName);
  if (!sanitized) {
    out.skipped.push({ name: rawName, reason: 'unusable file name' });
    return;
  }
  const { name, changed } = sanitized;
  if (!SUPPORTED_EXT.test(name)) {
    out.skipped.push({ name, reason: 'unsupported type (text files only: .csv .txt .tsv .dat .json .log .m)' });
    return;
  }
  if (byteLength(text) > MAX_UPLOAD_BYTES) {
    out.skipped.push({ name, reason: `too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024)} KB)` });
    return;
  }
  if (looksBinary(text)) {
    out.skipped.push({ name, reason: 'does not look like text' });
    return;
  }
  out.items.push({
    name,
    content: text,
    kind: isEditableUpload(name) ? 'editable' : 'data',
    renamedFrom: changed ? rawName : undefined,
  });
}

/** Read every dropped file. `.zip` files are unpacked and each entry
 *  routed through the same checks. Never throws for a single bad file --
 *  it lands in `skipped` with a reason. */
export async function collectUploads(files: FileList | File[]): Promise<UploadResult> {
  const out: UploadResult = { items: [], skipped: [] };

  for (const file of Array.from(files)) {
    try {
      if (/\.zip$/i.test(file.name)) {
        const zip = await JSZip.loadAsync(file);
        const entries = Object.values(zip.files).filter((e) => !e.dir);
        if (entries.length > MAX_ZIP_ENTRIES) {
          out.skipped.push({
            name: file.name,
            reason: `zip has ${entries.length} files; only the first ${MAX_ZIP_ENTRIES} were read`,
          });
        }
        for (const entry of entries.slice(0, MAX_ZIP_ENTRIES)) {
          try {
            consider(entry.name, await entry.async('string'), out);
          } catch {
            out.skipped.push({ name: entry.name, reason: 'could not read this zip entry' });
          }
        }
      } else if (file.size > MAX_UPLOAD_BYTES) {
        out.skipped.push({ name: file.name, reason: `too large (max ${Math.round(MAX_UPLOAD_BYTES / 1024)} KB)` });
      } else {
        consider(file.name, await readAsText(file), out);
      }
    } catch {
      out.skipped.push({ name: file.name, reason: 'could not read this file' });
    }
  }

  return out;
}

/** One-line-per-file human summary for the Command Window. */
export function summarizeUpload(result: UploadResult): string {
  const lines: string[] = [];
  for (const it of result.items) {
    lines.push(
      it.renamedFrom
        ? `Uploaded ${it.name} (renamed from ${it.renamedFrom}).`
        : `Uploaded ${it.name}.`,
    );
  }
  for (const s of result.skipped) {
    lines.push(`Skipped ${s.name} -- ${s.reason}.`);
  }
  return lines.length ? lines.join('\n') + '\n' : '';
}
