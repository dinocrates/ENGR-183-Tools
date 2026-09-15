export const PLOTLY_MIME = 'application/vnd.plotly.v1+json'
export const FIGURE_SUFFIX = '.figure.json'
export const MAX_FIGURE_BYTES = 8 * 1024 * 1024
export const MAX_SAVED_FIGURES = 50

export interface PlotlyFigure {
  data: unknown[]
  layout?: Record<string, unknown>
}

export interface SavedFigure {
  format: 'engr183-figure'
  version: 1
  name: string
  sourceScript: string | null
  plot: PlotlyFigure
}

export function figureStem(name: string): string {
  return name.slice(0, -FIGURE_SUFFIX.length)
}

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** This is a data document, never code or an Octave .fig file. Validate both
 * uploaded and persisted documents before handing them to the renderer. */
export function parseSavedFigure(text: string, name?: string): SavedFigure {
  if (new TextEncoder().encode(text).length > MAX_FIGURE_BYTES) {
    throw new Error('Saved figure exceeds the 8 MB limit')
  }
  const value = JSON.parse(text, (key, item) => {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error('Invalid figure property')
    return item
  })
  if (!object(value) || value.format !== 'engr183-figure' || value.version !== 1 ||
      typeof value.name !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.figure\.json$/.test(name ?? value.name) ||
      !(value.sourceScript === null || typeof value.sourceScript === 'string') ||
      !object(value.plot) || !Array.isArray(value.plot.data) ||
      !value.plot.data.every(object) ||
      !(value.plot.layout === undefined || object(value.plot.layout))) {
    throw new Error('Not a supported saved figure (expected ENGR-183 figure version 1)')
  }
  return {
    format: 'engr183-figure', version: 1, name: name ?? value.name,
    sourceScript: value.sourceScript, plot: value.plot as unknown as PlotlyFigure,
  }
}

export function serializeFigure(figure: SavedFigure): string {
  return JSON.stringify(figure)
}

export interface FigureCapture {
  sourceScript: string | null
  plots: Map<string, PlotlyFigure>
}

/** Stable names for successful script runs; command updates use the original
 * figure's name. A failed run preserves prior snapshots and adds new ones. */
export function mergeFigureCapture(
  previous: SavedFigure[], capture: FigureCapture, succeeded: boolean,
  identities: Map<string, string>,
): SavedFigure[] {
  const replacing = succeeded && capture.sourceScript !== null
  const next = replacing ? previous.filter(f => f.sourceScript !== capture.sourceScript) : [...previous]
  const updates = new Map<string, string>()
  let ordinal = 0
  for (const [id, plot] of capture.plots) {
    ordinal++
    const existing = !replacing && succeeded ? previous.find(f => f.name === identities.get(id)) : undefined
    const stem = (capture.sourceScript?.replace(/\.m$/i, '') ?? 'command').replace(/^[^A-Za-z0-9]+/, 'script_')
    let index = ordinal
    let name = existing?.name ?? `${stem}_figure_${index}${FIGURE_SUFFIX}`
    while (!existing && next.some(f => f.name.toLowerCase() === name.toLowerCase())) {
      name = `${stem}_figure_${++index}${FIGURE_SUFFIX}`
    }
    const snapshot = parseSavedFigure(JSON.stringify({
      format: 'engr183-figure', version: 1, name,
      sourceScript: existing?.sourceScript ?? capture.sourceScript, plot,
    }))
    const at = next.findIndex(f => f.name === name)
    if (at < 0) next.push(snapshot)
    else next[at] = snapshot
    updates.set(id, name)
  }
  if (next.length > MAX_SAVED_FIGURES) throw new Error('Remove some saved figures before saving more (limit: 50)')
  // Commit identity updates only after the complete capture validates.
  if (replacing) {
    const replaced = new Set(previous.filter(f => f.sourceScript === capture.sourceScript).map(f => f.name))
    for (const [id, name] of identities) if (replaced.has(name)) identities.delete(id)
  }
  for (const [id, name] of updates) identities.set(id, name)
  return next
}
