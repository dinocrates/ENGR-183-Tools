import type { PlotlyFigure } from './savedFigures'

/** Match the interactive figure's theme without altering the saved data. */
export function figureLayout(layout?: Record<string, unknown>): Record<string, unknown> {
  const styled = structuredClone(layout ?? {})
  if (Array.isArray(styled.annotations)) {
    styled.annotations = styled.annotations.map(annotation => {
      if (!annotation || typeof annotation !== 'object' || Array.isArray(annotation)) return annotation
      // Octave already positions unframed text inside its legend axes.
      // Plotly otherwise adds an invisible 1px border plus 1px padding,
      // shifting left-anchored labels 2px toward the legend's right edge.
      // Keep explicitly styled annotation boxes as supplied.
      if ('bordercolor' in annotation || 'bgcolor' in annotation) return annotation
      return { borderpad: 0, borderwidth: 0, ...annotation }
    })
  }
  return {
    ...styled,
    paper_bgcolor: '#ffffff', plot_bgcolor: '#ffffff',
    // Use a Helvetica-compatible default for Octave's pre-sized legends.
    // Plotly's default falls back to wider Verdana when Open Sans is absent,
    // which lets labels extend beyond the already-computed legend border.
    font: { family: 'Arial, Helvetica, sans-serif', color: '#1e293b', size: 11 },
    modebar: { orientation: 'v' },
  }
}

/** Render from the saved snapshot, not a possibly closed/minimized window.
 * Export at the original canvas dimensions so Octave's annotations line up. */
export async function figurePng(figure: PlotlyFigure): Promise<Blob> {
  const Plotly = await import('plotly.js-dist-min')
  const container = document.createElement('div')
  const dimension = (n: unknown, fallback: number) =>
    typeof n === 'number' && Number.isFinite(n) ? Math.max(220, Math.min(2400, n)) : fallback
  const width = dimension(figure.layout?.width, 560)
  const height = dimension(figure.layout?.height, 420)
  Object.assign(container.style, {
    position: 'fixed', left: '-10000px', top: '0', width: `${width}px`, height: `${height}px`,
  })
  container.setAttribute('aria-hidden', 'true')
  document.body.append(container)
  let timer: ReturnType<typeof setTimeout> | undefined
  const render = (async () => {
    await Plotly.newPlot(container, structuredClone(figure.data), {
      ...figureLayout(figure.layout), width, height,
    }, { staticPlot: true, displayModeBar: false })
    const url = await Plotly.toImage(container, { format: 'png', width, height })
    return (await fetch(url)).blob()
  })()
  try {
    return await Promise.race([
      render,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Figure export timed out. Try downloading again.')), 45000)
      }),
    ])
  } finally {
    clearTimeout(timer)
    container.remove()
    // A slow renderer may settle after the timeout; release it then too.
    void render.finally(() => Plotly.purge(container)).catch(() => {})
  }
}
