const BAR_MIME = 'application/vnd.engr183.plot-bars+json';
const PLOTLY_MIME = 'application/vnd.plotly.v1+json';

interface BarGeometry {
  xDomain: number[]; yDomain: number[];
  centers: number[]; widths: number[]; heights: number[]; bases: number[];
  orientation: 'v' | 'h'; color: string; edgeColor: string; lineWidth: number; opacity: number;
}

/** The pinned toolkit emits an empty trace for native bar hggroups/patches.
 * Merge native rectangle geometry on the matching axes, below reference lines. */
export class PlotBars {
  private bars = new Map<string, BarGeometry[]>();
  private originals = new Map<string, Record<string, unknown>>();
  private changedId: string | undefined;

  consume(bundle: Record<string, unknown>): boolean {
    if (!(BAR_MIME in bundle)) return false;
    this.changedId = undefined;
    try {
      const raw = bundle[BAR_MIME];
      const snapshot = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (snapshot && typeof snapshot.figureId === 'string' && Array.isArray(snapshot.bars)) {
        this.changedId = snapshot.figureId;
        if (snapshot.bars.length) this.bars.set(snapshot.figureId, snapshot.bars);
        else this.bars.delete(snapshot.figureId);
      }
    } catch { /* Auxiliary graphics output must not strand execution. */ }
    return true;
  }

  refresh(): { displayId: string; mimeBundle: Record<string, unknown> } | undefined {
    const id = this.changedId;
    const original = id ? this.originals.get(id) : undefined;
    if (!id || !original) return undefined;
    const mimeBundle = this.apply(id, original);
    if (!this.bars.has(id)) this.originals.delete(id);
    return { displayId: id, mimeBundle };
  }

  apply(id: string | undefined, bundle: Record<string, unknown>): Record<string, unknown> {
    const bars = id ? this.bars.get(id) : undefined;
    const figure = bundle[PLOTLY_MIME] as { data?: unknown[]; layout?: Record<string, unknown> } | undefined;
    if (!bars?.length || !figure) return bundle;
    if (id) this.originals.set(id, bundle);
    const layout = figure.layout ?? {};
    const axis = (dimension: 'x' | 'y', domain: number[]) => {
      if (!Array.isArray(domain) || domain.length !== 2) return undefined;
      return Object.entries(layout).find(([name, value]) => {
        if (!new RegExp(`^${dimension}axis\\d*$`).test(name)) return false;
        const limits = (value as { domain?: number[] })?.domain;
        return limits?.length === 2 && limits.every((v, i) => Math.abs(v - domain[i]) < 1e-4);
      })?.[0].replace('axis', '');
    };
    const traces = bars.flatMap(bar => {
      const xaxis = axis('x', bar.xDomain); const yaxis = axis('y', bar.yDomain);
      if (!xaxis || !yaxis || !Array.isArray(bar.centers) || !Array.isArray(bar.heights)) return [];
      return [{
        type: 'bar', xaxis, yaxis, orientation: bar.orientation,
        x: bar.orientation === 'h' ? bar.heights : bar.centers,
        y: bar.orientation === 'h' ? bar.centers : bar.heights,
        width: bar.widths, offset: bar.widths.map(width => -width / 2), base: bar.bases, opacity: bar.opacity,
        marker: { color: bar.color, line: { color: bar.edgeColor, width: bar.lineWidth } },
        showlegend: false, name: '',
      }];
    });
    return { ...bundle, [PLOTLY_MIME]: { ...figure, data: [...traces, ...(figure.data ?? [])] } };
  }
}
