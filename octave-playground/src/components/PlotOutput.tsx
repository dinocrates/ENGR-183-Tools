import { useEffect, useRef, useState } from 'react'
import type * as PlotlyModule from 'plotly.js-dist-min'

const PLOTLY_MIME = 'application/vnd.plotly.v1+json'

interface PlotlyFigure {
  data: unknown[]
  layout?: Record<string, unknown>
}

interface PlotOutputProps {
  mimeBundle: Record<string, unknown>
  // True once the run that would have populated this figure has settled
  // with no data ever arriving -- see Playground.tsx's runCode(). Distinct
  // from mid-render "still loading": that state resolves on its own, this
  // one provably never will (execute_reply is always the last message for
  // a command), so it gets a real error state instead of an infinite spinner.
  failed?: boolean
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

function RenderingSpinner() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-line border-t-accent" />
      <span className="text-xs text-muted">Rendering…</span>
    </div>
  )
}

// For the failed=true case: a real, intermittent kernel bug (DESIGN.md
// T3.21) where a figure's data can silently never arrive even though the
// run that should have populated it otherwise succeeded. Deliberately
// styled like an error, not a variant of the loading spinner -- this
// figure is provably never going to complete, so it shouldn't look like
// it's still working.
function FailedPlot() {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white p-4 text-center">
      <span className="text-2xl">⚠️</span>
      <span className="max-w-xs text-xs text-slate-600">
        This plot didn't finish rendering — a known, occasional issue after re-activating a figure with{' '}
        <code className="text-slate-800">figure(N)</code>. Close this window and run again.
      </span>
    </div>
  )
}

// Dynamically imported: plotly.js is the only way to render what the kernel
// sends (application/vnd.plotly.v1+json, confirmed the only MIME type it
// emits -- no PNG fallback, see m0-spike-driver/t18-plot-mime.js), but it's
// ~1MB and most units never plot, so it shouldn't cost anything on units
// that don't need it.
export function PlotOutput({ mimeBundle, failed, width, height }: PlotOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  // True while waiting on either the ~1MB plotly.js-dist-min download (first
  // plot of a session only, cached after) or Plotly.newPlot() itself for a
  // large figure -- both can genuinely take a while, and a blank white box
  // with no feedback looks broken rather than "still working."
  const [rendering, setRendering] = useState(false)
  // Distinct from the ordinary "still loading" spinner: found via torture
  // testing that a plot can occasionally take much longer than usual to
  // render after the figure(N) reactivation kernel bug (DESIGN.md T3.21/
  // T3.23) -- confirmed via a direct repro that this isn't a malformed- or
  // missing-data case (the payload dumped completely well-formed) and, in
  // every observed instance, the render did eventually complete on its own
  // given enough time (one case took over 15s). So this timeout is
  // deliberately generous -- 45s -- to stay well clear of a legitimately
  // slow-but-working render; it exists only to eventually surface *some*
  // feedback if a render genuinely never finishes, not to fire on the
  // normal case observed so far. The "data never arrives at all" case is
  // separate (handled in the !figure branch below, via the failed prop
  // from Playground.tsx) -- this one is specifically "data arrived, the
  // render itself is just taking unusually long," where neither .then()
  // nor .catch() gives any signal to react to.
  const [renderStuck, setRenderStuck] = useState(false)
  const figure = mimeBundle[PLOTLY_MIME] as PlotlyFigure | undefined

  useEffect(() => {
    const container = containerRef.current
    if (!figure || !container) return
    let cancelled = false
    setRendering(true)
    setRenderStuck(false)
    const stuckTimer = setTimeout(() => {
      if (!cancelled) setRenderStuck(true)
    }, 45000)

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
      return Plotly.newPlot(container, figure.data as never, layout, {
        responsive: width === undefined,
        displaylogo: false,
        // Plotly's modebar (zoom/pan/box-select/reset/camera) defaults to
        // hover-reveal, which is easy for a student to never discover.
        // Desktop Octave's own Figure toolbar is always visible -- match
        // that instead of relying on a hover affordance.
        displayModeBar: true,
      })
    }).then(() => {
      clearTimeout(stuckTimer)
      if (!cancelled) setRendering(false)
    }).catch((err) => {
      clearTimeout(stuckTimer)
      if (!cancelled) {
        setError(String(err))
        setRendering(false)
      }
    })

    return () => {
      cancelled = true
      clearTimeout(stuckTimer)
      if (cachedPlotly && (container as unknown as { data?: unknown }).data) {
        cachedPlotly.purge(container)
      }
    }
  }, [figure, width, height])

  if (!figure) {
    if (failed) {
      return (
        <div className="relative h-full w-full">
          <FailedPlot />
        </div>
      )
    }
    // An empty bundle is the momentary placeholder xeus-octave sends before
    // the real figure arrives via update_display_data -- show the same
    // spinner as the "have data, still drawing" case rather than a blank
    // box, since a student can't tell those two waits apart anyway.
    if (Object.keys(mimeBundle).length === 0) {
      return (
        <div className="relative h-full w-full">
          <RenderingSpinner />
        </div>
      )
    }
    return (
      <div className="text-xs text-muted">
        (unsupported output type: {Object.keys(mimeBundle).join(', ')})
      </div>
    )
  }

  if (error) {
    return <div className="text-xs text-danger-fg">Couldn't render plot: {error}</div>
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      {rendering && (renderStuck ? <FailedPlot /> : <RenderingSpinner />)}
    </div>
  )
}
