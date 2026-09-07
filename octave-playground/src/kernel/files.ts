// Bridges the browser-persisted contents drive (survives a refresh) and the
// kernel's own filesystem (what Octave actually reads when running tests).
// Per DESIGN.md §4.2: edits are held in the drive; "Run Tests"/"Run File"
// write the current buffers into the kernel's mounted assignments/<unit>/
// path, then execute -- validated end-to-end in T1.4's spike
// (m0-spike-driver/t14-harness-run.js).
import { ContentsManager } from '@jupyterlab/services';
import { BrowserStorageDrive } from '@jupyterlite/services';
import localforage from 'localforage';
import { injectBreakpoints } from './breakpoints';

export function createContentsManager(): ContentsManager {
  const drive = new BrowserStorageDrive({
    name: 'engr183-drive',
    localforage,
  });
  return new ContentsManager({ defaultDrive: drive });
}

function starterUrl(unitId: string, fileName: string): string {
  return `${import.meta.env.BASE_URL}starters/${unitId}/${fileName}`;
}

// Student-supplied file names flow into buildWriteFilesCode below, which
// interpolates them unescaped into a single-quoted Octave string literal
// (fopen(...)) and into a bare `clear <name>` statement. Restricting the base
// name to valid Octave identifier characters keeps that generation
// injection-safe for free, on top of being the only names Octave would treat
// as a real function/script file anyway.
const FILE_BASE_NAME_RE = /^[A-Za-z_]\w*$/;

// A unit's dataFiles names (from the unit JSON, instructor-controlled) also
// flow into buildWriteFilesCode's fopen() path -- but they're not Octave
// identifiers (they carry a `.csv`/`.txt` extension), so they get their own
// rule: letters, digits, dot, underscore, hyphen only. No path separators,
// no quotes, nothing that could break out of the single-quoted literal.
// Unlike a .m file, a dataFile is never `clear`ed (it's not a function).
const DATA_FILE_NAME_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?$/;

/** True if `name` is a well-formed unit dataFiles entry -- see
 *  DATA_FILE_NAME_RE. A malformed entry is dropped (with a console warning)
 *  rather than risking it in generated Octave. */
export function isValidDataFileName(name: string): boolean {
  return DATA_FILE_NAME_RE.test(name) && !/\.m$/i.test(name);
}

/** Largest single uploaded file we accept. Uploads ride the same
 *  fwrite(uint8([...])) path as starters (see buildWriteFilesCode), which
 *  balloons to roughly 4x the file size as JS in every run's source, so
 *  the cap is deliberately conservative -- course data files are kilobytes,
 *  not megabytes. */
export const MAX_UPLOAD_BYTES = 512 * 1024;

/** Most entries we pull out of a single uploaded .zip. */
export const MAX_ZIP_ENTRIES = 50;

/** Normalizes a student-uploaded file name: trims, drops any directory
 *  path (zip entries carry one), lowercases the extension, and replaces
 *  every run of characters outside [A-Za-z0-9._-] with a single '_'.
 *  Returns { name, changed } or null if nothing usable survives (e.g. an
 *  empty name, or one that is all separators). A `.m` upload is validated
 *  through normalizeFileName instead so it stays a real Octave identifier;
 *  everything else must satisfy DATA_FILE_NAME_RE after sanitizing. */
export function sanitizeUploadName(raw: string): { name: string; changed: boolean } | null {
  const base = raw.split(/[\\/]/).pop()?.trim() ?? '';
  if (base.length === 0) return null;

  if (/\.m$/i.test(base)) {
    const normalized = normalizeFileName(base);
    return normalized ? { name: normalized, changed: normalized !== base } : null;
  }

  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase() : '';
  const cleanStem = stem.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._-]+|[._-]+$/g, '');
  const cleanExt = ext.replace(/[^A-Za-z0-9]+/g, '');
  if (cleanStem.length === 0) return null;
  const name = cleanExt ? `${cleanStem}.${cleanExt}` : cleanStem;
  if (!DATA_FILE_NAME_RE.test(name)) return null;
  return { name, changed: name !== base };
}

/** Whether an uploaded name is a `.m` file (routed to the editable tab set)
 *  as opposed to a data file (routed to the read-only "My files" group). */
export function isEditableUpload(name: string): boolean {
  return /\.m$/i.test(name);
}

/** Rough "this is text, not a binary blob we can't handle" check on
 *  already-decoded content: a NUL byte or a cluster of U+FFFD replacement
 *  characters means readAsText was fed something that isn't UTF-8 text
 *  (an image, .xlsx, .mat, ...). */
export function looksBinary(text: string): boolean {
  if (text.length === 0) return false;
  let replacements = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code === 0) return true;
    if (code === 0xfffd) replacements++;
  }
  return replacements / text.length > 0.01;
}

/** Normalizes a student-entered file name (trims, strips a `.m`/`.M`
 *  extension if present so it can be re-appended in a consistent case rather
 *  than double-suffixed, e.g. "HELPER.M" -> "HELPER.m" not "HELPER.M.m")
 *  and validates the base name. Returns the normalized name, or null if
 *  invalid. */
export function normalizeFileName(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const base = /\.m$/i.test(trimmed) ? trimmed.slice(0, -2) : trimmed;
  return FILE_BASE_NAME_RE.test(base) ? `${base}.m` : null;
}

export class UnitFiles {
  private contents: ContentsManager
  private unitId: string

  constructor(contents: ContentsManager, unitId: string) {
    this.contents = contents
    this.unitId = unitId
  }

  private path(fileName: string): string {
    return `${this.unitId}/${fileName}`;
  }

  private async ensureUnitDir(): Promise<void> {
    try {
      await this.contents.get(this.unitId, { content: false });
    } catch {
      await this.contents.save(this.unitId, { type: 'directory' });
    }
  }

  /** Load each file from the persisted drive, seeding from the starter on
   *  first visit (or if the student never saved that particular file). */
  async load(fileNames: string[]): Promise<Record<string, string>> {
    await this.ensureUnitDir();
    const result: Record<string, string> = {};
    for (const name of fileNames) {
      try {
        const model = await this.contents.get(this.path(name), { content: true });
        result[name] = typeof model.content === 'string' ? model.content : '';
      } catch {
        result[name] = await this.resetToStarter(name);
      }
    }
    return result;
  }

  /** Load bundled read-only data files. Unlike load(), these are always
   *  fetched fresh from the vendored starter asset and never read from (or
   *  written to) the browser drive: the student can't edit them, so a
   *  drive copy would only ever be a stale or corrupted shadow of the real
   *  thing. A file that 404s is skipped with a console warning rather than
   *  failing the whole unit load. */
  async loadDataFiles(fileNames: string[]): Promise<Record<string, string>> {
    const result: Record<string, string> = {};
    for (const name of fileNames) {
      try {
        const res = await fetch(starterUrl(this.unitId, name));
        if (!res.ok) {
          console.warn(`Data file ${this.unitId}/${name} not found (${res.status}); skipping.`);
          continue;
        }
        result[name] = await res.text();
      } catch (err) {
        console.warn(`Could not load data file ${this.unitId}/${name}:`, err);
      }
    }
    return result;
  }

  /** Load files straight from the drive with no starter fallback -- for
   *  student-uploaded files (data files in the "My files" group), which
   *  have no vendored starter to fall back to. A name that isn't in the
   *  drive is skipped rather than throwing. */
  async loadRaw(fileNames: string[]): Promise<Record<string, string>> {
    await this.ensureUnitDir();
    const result: Record<string, string> = {};
    for (const name of fileNames) {
      try {
        const model = await this.contents.get(this.path(name), { content: true });
        result[name] = typeof model.content === 'string' ? model.content : '';
      } catch {
        // not in the drive (deleted in another tab, storage cleared) -- skip
      }
    }
    return result;
  }

  async save(fileName: string, content: string): Promise<void> {
    await this.contents.save(this.path(fileName), {
      type: 'file',
      format: 'text',
      content,
    });
  }

  async delete(fileName: string): Promise<void> {
    await this.contents.delete(this.path(fileName));
  }

  /** Lists the unit's directory in the drive and returns the names of any
   *  files there that aren't in `knownFiles` -- i.e. files a student added
   *  in a previous session, which otherwise have no record anywhere except
   *  the drive itself (no manifest file; the directory listing IS the
   *  source of truth for "what extra files exist"). */
  async listExtraFiles(knownFiles: string[]): Promise<string[]> {
    await this.ensureUnitDir();
    const dir = await this.contents.get(this.unitId, { content: true });
    const children = Array.isArray(dir.content) ? (dir.content as { name: string; type: string }[]) : [];
    const known = new Set(knownFiles);
    return children.filter((c) => c.type === 'file' && !known.has(c.name)).map((c) => c.name);
  }

  /** Fetch the original starter content, save it as the file, and return it. */
  async resetToStarter(fileName: string): Promise<string> {
    const res = await fetch(starterUrl(this.unitId, fileName));
    if (!res.ok) {
      throw new Error(`Could not load starter for ${this.unitId}/${fileName}: ${res.status}`);
    }
    const text = await res.text();
    await this.save(fileName, text);
    return text;
  }
}

/** Octave source that writes `files` into the kernel's mounted
 *  assignments/<unitId>/ path -- as raw uint8 byte arrays via fwrite, so
 *  file content never has to be escaped into an Octave string literal
 *  (student code routinely contains quotes, which broke naive
 *  fputs(sprintf('...')) approaches during T1.4 testing). base64_decode
 *  was tried first but is broken in this xeus-octave build -- it fails
 *  even round-tripping Octave's own base64_encode output.
 *
 *  Also `clear`s each written *function* (`.m`) by name. Octave caches a
 *  function by the path it first loaded it from; overwriting the file on
 *  disk doesn't invalidate that cache (confirmed directly -- even `rehash`
 *  doesn't help, only `clear <name>` does). Without this, a student who
 *  runs Tests once, then fixes their code and runs again in the same
 *  kernel session, would silently see the stale first-run result. Bundled
 *  data files (`.csv` etc.) are written the same way but never `clear`ed:
 *  they aren't functions, and `clear readings.csv` isn't valid syntax. */
export function buildWriteFilesCode(
  unitId: string,
  files: Record<string, string>,
  breakpoints?: Record<string, Iterable<number>>,
): string {
  const dir = `/engr183/assignments/${unitId}`;
  const lines: string[] = [
    // Make the engr183 package resolvable for every run mode, not just Run
    // Tests (which also addpath's it explicitly). Run File / Debug / the
    // REPL need it too so student code can call engr183.data('...') to
    // locate a bundled data file. Idempotent -- Octave just moves an
    // already-present entry to the front.
    `addpath('/engr183');`,
    `if ~exist('/engr183/assignments', 'dir'), mkdir('/engr183/assignments'); end`,
    `if ~exist('${dir}', 'dir'), mkdir('${dir}'); end`,
  ];
  for (const [name, rawContent] of Object.entries(files)) {
    const bpLines = breakpoints?.[name];
    const content = bpLines ? injectBreakpoints(rawContent, bpLines) : rawContent;
    const bytes = Array.from(new TextEncoder().encode(content));
    lines.push(
      `fid = fopen('${dir}/${name}', 'w'); fwrite(fid, uint8([${bytes.join(',')}]), 'uint8'); fclose(fid);`,
    );
    if (/\.m$/i.test(name)) {
      lines.push(`clear ${name.replace(/\.m$/i, '')}`);
    }
  }
  // `fid` is our own bookkeeping, reused across the loop above -- clear it so
  // it doesn't show up as a leftover base-workspace variable in the
  // Workspace panel (T3.7), which reflects exactly what `whos()` sees.
  if (Object.keys(files).length > 0) {
    lines.push('clear fid');
  }
  return lines.join('\n');
}
