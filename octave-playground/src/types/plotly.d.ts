// plotly.js-dist-min ships no types of its own; @types/plotly.js targets the
// full 'plotly.js' package name, not this one. We only call newPlot/purge,
// so a minimal local shim beats pulling in the full upstream typings.
declare module 'plotly.js-dist-min' {
  export type PlotlyHTMLElement = HTMLDivElement

  export function newPlot(
    root: HTMLDivElement,
    data: unknown[],
    layout?: Record<string, unknown>,
    config?: Record<string, unknown>,
  ): Promise<PlotlyHTMLElement>

  export function purge(root: HTMLDivElement): void
}
