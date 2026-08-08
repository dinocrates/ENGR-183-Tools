import { useEffect, useRef, useState } from 'react'
import type * as PlotlyModule from 'plotly.js-dist-min'

const PLOTLY_MIME = 'application/vnd.plotly.v1+json'

interface PlotlyFigure {
  data: unknown[]
  layout?: Record<string, unknown>
}

interface PlotOutputProps {
  mimeBundle: Record<string, unknown>
  // Fixed pixel size, when the caller's container size is itself fixed (as
  // FloatingFigure's is). Falls back to autosize/responsive if omitted, for
  // a container whose size can genuinely change after mount.
  width?: number
  height?: number
}

// Cached at module scope (not re-imported per mount): a plot that changes
// twice in quick succession -- e.g. `plot(x,sin(x)); hold on; plot(x,cos(x))`
// sends two update_display_data messages for the same figure -- was racing
// its own cleanup. Both the new effect's setup and the old effect's cleanup
// did `import('plotly.js-dist-min').then(...)`; nothing guaranteed the old
// one's purge() resolved before the new one's newPlot() ran, so a fast
// second update could draw on top of the first without clearing it first
// (visually: a doubled/offset legend box, even though the underlying trace
// data was always correct -- confirmed via m0-spike-driver/t37c-inspect.js).
// Caching the resolved module lets cleanup call purge() synchronously once
// loaded, so React's synchronous cleanup-before-next-effect ordering
// actually applies.
let cachedPlotly: typeof PlotlyModule | undefined
let loadingPlotly: Promise<typeof PlotlyModule> | undefined
function loadPlotly(): Promise<typeof PlotlyModule> {
  if (cachedPlotly) return Promise.resolve(cachedPlotly)
  if (!loadingPlotly) {
    loadingPlotly = import('plotly.js-dist-min').then((mod) => {
      cachedPlotly = mod
      return mod
    })
  }
  return loadingPlotly
}

// Dynamically imported: plotly.js is the only way to render what the kernel
// sends (application/vnd.plotly.v1+json, confirmed the only MIME type it
// emits -- no PNG fallback, see m0-spike-driver/t18-plot-mime.js), but it's
// ~1MB and most units never plot, so it shouldn't cost anything on units
// that don't need it.
export function PlotOutput({ mimeBundle, width, height }: PlotOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const figure = mimeBundle[PLOTLY_MIME] as PlotlyFigure | undefined

  useEffect(() => {
    const container = containerRef.current
    if (!figure || !container) return
    let cancelled = false

    loadPlotly().then((Plotly) => {
      if (cancelled) return
      // Belt and suspenders alongside the synchronous cleanup below: if this
      // container already holds a plot (e.g. the module wasn't cached yet
      // the first time and cleanup couldn't run synchronously), clear it
      // before drawing a new one rather than layering renders.
      if ((container as unknown as { data?: unknown }).data) {
        Plotly.purge(container)
      }
      // figure.layout comes from xeus-octave's own default Plotly config.
      // Spread it FIRST so our own choices below always win for the things
      // we deliberately override -- but override as little as possible.
      // legend()-in-Octave turns out to be implemented via Plotly
      // *annotations* (text + leader lines), not Plotly's native legend --
      // the kernel sets showlegend:false specifically to suppress its own
      // redundant native legend underneath its hand-drawn one. An earlier
      // version of this file forced showlegend:true and set a custom
      // `legend` position, not realizing that -- the result was Plotly's
      // real legend rendering ON TOP of the kernel's own annotation-based
      // one, a visible doubled/offset legend box (confirmed by dumping
      // every SVG text node: two "sin(x)"/"cos(x)" pairs, one classed
      // `legendtext` from Plotly's native legend, one classed
      // `annotation-text` from the kernel's own -- see
      // m0-spike-driver/t37i-alltraces.js). The kernel's annotation
      // positions are computed for its own declared canvas size, which is
      // why width/height are matched exactly via the width/height props
      // below instead of being stripped -- margin is left alone for the
      // same reason (an earlier version forced non-zero margins, shifting
      // the plot area out from under annotations positioned for the
      // kernel's own zero-margin default).
      const layout: Record<string, unknown> = {
        ...figure.layout,
        paper_bgcolor: '#ffffff',
        plot_bgcolor: '#ffffff',
        font: { color: '#1e293b', size: 11 },
      }
      if (width !== undefined) layout.width = width
      if (height !== undefined) layout.height = height
      Plotly.newPlot(container, figure.data as never, layout, {
        responsive: width === undefined,
        displaylogo: false,
      })
    }).catch((err) => setError(String(err)))

    return () => {
      cancelled = true
      if (cachedPlotly && (container as unknown as { data?: unknown }).data) {
        cachedPlotly.purge(container)
      }
    }
  }, [figure, width, height])

  if (!figure) {
    // An empty bundle is the momentary placeholder xeus-octave sends before
    // the real figure arrives via update_display_data -- not an error.
    if (Object.keys(mimeBundle).length === 0) {
      return null
    }
    return (
      <div className="text-xs text-neutral-500">
        (unsupported output type: {Object.keys(mimeBundle).join(', ')})
      </div>
    )
  }

  if (error) {
    return <div className="text-xs text-red-400">Couldn't render plot: {error}</div>
  }

  return <div ref={containerRef} className="h-full w-full" />
}
