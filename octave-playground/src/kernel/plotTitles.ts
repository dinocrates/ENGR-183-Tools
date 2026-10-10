const TITLE_MIME = 'application/vnd.engr183.plot-titles+json';
const PLOTLY_MIME = 'application/vnd.plotly.v1+json';

/** The native toolkit omits axes titles. Merge the shim's annotations into
 * each subsequent native figure payload, preserving its legend annotations. */
export class PlotTitles {
  private titles = new Map<string, unknown[]>();
  private sizes = new Map<string, { width: number; height: number }>();

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
      if (Number.isFinite(snapshot.width) && snapshot.width > 0 &&
          Number.isFinite(snapshot.height) && snapshot.height > 0) {
        this.sizes.set(snapshot.figureId, { width: snapshot.width, height: snapshot.height });
      }
    }
    return true;
  }

  apply(id: string | undefined, bundle: Record<string, unknown>): Record<string, unknown> {
    const titles = id ? this.titles.get(id) : undefined;
    const size = id ? this.sizes.get(id) : undefined;
    const figure = bundle[PLOTLY_MIME] as { layout?: Record<string, unknown> } | undefined;
    if ((!titles?.length && !size) || !figure) return bundle;
    const layout = figure.layout ?? {};
    const annotations = Array.isArray(layout.annotations) ? layout.annotations : [];
    return {
      ...bundle,
      [PLOTLY_MIME]: { ...figure, layout: { ...layout, ...size, annotations: [...annotations, ...(titles ?? [])] } },
    };
  }
}
