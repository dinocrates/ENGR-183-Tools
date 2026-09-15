import titleSource from './octave/title.m?raw';

const TITLE_MIME = 'application/vnd.engr183.plot-titles+json';
const PLOTLY_MIME = 'application/vnd.plotly.v1+json';

/** Install only in the browser kernel; desktop Octave needs no workaround. */
export function installPlotTitleCode(): string {
  const bytes = Array.from(new TextEncoder().encode(titleSource));
  return [
    `setappdata(0, '__engr183_native_title__', @title);`,
    `mkdir('/tmp/engr183-graphics');`,
    `__engr183_fid__ = fopen('/tmp/engr183-graphics/title.m', 'w');`,
    `fwrite(__engr183_fid__, uint8([${bytes.join(',')}]), 'uint8');`,
    `fclose(__engr183_fid__); clear __engr183_fid__;`,
    // This intentional shadow should not produce a student-facing warning.
    `__engr183_warning__ = warning('query', 'Octave:shadowed-function');`,
    `warning('off', 'Octave:shadowed-function');`,
    `addpath('/tmp/engr183-graphics');`,
    `warning(__engr183_warning__.state, 'Octave:shadowed-function'); clear __engr183_warning__;`,
  ].join('\n');
}

/** The native toolkit omits axes titles. Merge the shim's annotations into
 * each subsequent native figure payload, preserving its legend annotations. */
export class PlotTitles {
  private titles = new Map<string, unknown[]>();

  consume(bundle: Record<string, unknown>): boolean {
    if (!(TITLE_MIME in bundle)) return false;
    const raw = bundle[TITLE_MIME];
    let snapshot;
    try {
      snapshot = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch {
      // Malformed auxiliary output must not strand the execute request.
      return true;
    }
    if (snapshot && typeof snapshot.figureId === 'string' && Array.isArray(snapshot.annotations)) {
      if (snapshot.annotations.length) this.titles.set(snapshot.figureId, snapshot.annotations);
      else this.titles.delete(snapshot.figureId);
    }
    return true;
  }

  apply(id: string | undefined, bundle: Record<string, unknown>): Record<string, unknown> {
    const titles = id ? this.titles.get(id) : undefined;
    const figure = bundle[PLOTLY_MIME] as { layout?: Record<string, unknown> } | undefined;
    if (!titles?.length || !figure) return bundle;
    const layout = figure.layout ?? {};
    const annotations = Array.isArray(layout.annotations) ? layout.annotations : [];
    return {
      ...bundle,
      [PLOTLY_MIME]: { ...figure, layout: { ...layout, annotations: [...annotations, ...titles] } },
    };
  }
}
