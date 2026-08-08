import { useEffect, useRef, useState } from 'react'
import type { PlotlyHTMLElement } from 'plotly.js-dist-min'

const PLOTLY_MIME = 'application/vnd.plotly.v1+json'

interface PlotlyFigure {
  data: unknown[]
  layout?: Record<string, unknown>
}

interface PlotOutputProps {
  mimeBundle: Record<string, unknown>
}

// Dynamically imported: plotly.js is the only way to render what the kernel
// sends (application/vnd.plotly.v1+json, confirmed the only MIME type it
// emits -- no PNG fallback, see m0-spike-driver/t18-plot-mime.js), but it's
// ~1MB and most units never plot, so it shouldn't cost anything on units
// that don't need it.
export function PlotOutput({ mimeBundle }: PlotOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const figure = mimeBundle[PLOTLY_MIME] as PlotlyFigure | undefined

  useEffect(() => {
    if (!figure || !containerRef.current) return
    let plotEl: PlotlyHTMLElement | null = null
    let cancelled = false

    import('plotly.js-dist-min').then((Plotly) => {
      if (cancelled || !containerRef.current) return
      // figure.layout comes from xeus-octave's own default Plotly config,
      // which sets an explicit pixel width/height (e.g. 560x420) and its own
      // plot_bgcolor -- spread it FIRST so our own choices below always win,
      // otherwise the kernel's fixed size overrides `responsive` (the figure
      // window and the plot inside it visibly mismatch) and its transparent
      // background shows the dark app chrome through the "paper" area. Real
      // Octave/MATLAB figures render on a white background regardless of the
      // app's own theme -- that's the authentic look, not something to
      // reskin to match the surrounding dark UI.
      const layout: Record<string, unknown> = {
        ...figure.layout,
        paper_bgcolor: '#ffffff',
        plot_bgcolor: '#ffffff',
        font: { color: '#1e293b', size: 11 },
        margin: { t: 30, r: 20, b: 40, l: 50 },
        autosize: true,
      }
      delete layout.width
      delete layout.height
      Plotly.newPlot(containerRef.current, figure.data as never, layout, {
        responsive: true,
        displaylogo: false,
      }).then((el) => {
        plotEl = el
      })
    }).catch((err) => setError(String(err)))

    return () => {
      cancelled = true
      if (plotEl) void import('plotly.js-dist-min').then((Plotly) => Plotly.purge(plotEl!))
    }
  }, [figure])

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
