// Bridges the browser-persisted contents drive (survives a refresh) and the
// kernel's own filesystem (what Octave actually reads when running tests).
// Per DESIGN.md §4.2: edits are held in the drive; "Run Tests"/"Run File"
// write the current buffers into the kernel's mounted assignments/<unit>/
// path, then execute -- validated end-to-end in T1.4's spike
// (m0-spike-driver/t14-harness-run.js).
import { ContentsManager } from '@jupyterlab/services';
import { BrowserStorageDrive } from '@jupyterlite/services';
import localforage from 'localforage';

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

  async save(fileName: string, content: string): Promise<void> {
    await this.contents.save(this.path(fileName), {
      type: 'file',
      format: 'text',
      content,
    });
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
 *  Also `clear`s each written function by name. Octave caches a function
 *  by the path it first loaded it from; overwriting the file on disk
 *  doesn't invalidate that cache (confirmed directly -- even `rehash`
 *  doesn't help, only `clear <name>` does). Without this, a student who
 *  runs Tests once, then fixes their code and runs again in the same
 *  kernel session, would silently see the stale first-run result. */
export function buildWriteFilesCode(unitId: string, files: Record<string, string>): string {
  const dir = `/engr183/assignments/${unitId}`;
  const lines: string[] = [
    `if ~exist('/engr183/assignments', 'dir'), mkdir('/engr183/assignments'); end`,
    `if ~exist('${dir}', 'dir'), mkdir('${dir}'); end`,
  ];
  for (const [name, content] of Object.entries(files)) {
    const bytes = Array.from(new TextEncoder().encode(content));
    const fnName = name.replace(/\.m$/, '');
    lines.push(
      `fid = fopen('${dir}/${name}', 'w'); fwrite(fid, uint8([${bytes.join(',')}]), 'uint8'); fclose(fid);`,
      `clear ${fnName}`,
    );
  }
  return lines.join('\n');
}
