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
      Plotly.newPlot(
        containerRef.current,
        figure.data as never,
        {
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          font: { color: '#d4d4d4', size: 11 },
          margin: { t: 30, r: 20, b: 40, l: 50 },
          ...figure.layout,
        },
        { responsive: true, displaylogo: false },
      ).then((el) => {
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
      <div className="my-2 text-xs text-neutral-500">
        (unsupported output type: {Object.keys(mimeBundle).join(', ')})
      </div>
    )
  }

  if (error) {
    return <div className="my-2 text-xs text-red-400">Couldn't render plot: {error}</div>
  }

  return <div ref={containerRef} className="my-2 h-72 w-full max-w-2xl" />
}
