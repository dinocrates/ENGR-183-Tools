Playwright/Node scripts used to produce `../M0-FINDINGS.md`. Scratch, not shipped code.

Requires the M0 spike site built and served locally (see M0-FINDINGS.md T0.1) at
`http://localhost:8000`. `npm install && npx playwright install chromium` first.

- `explore.js` — loads the REPL app, dumps interesting `window` globals and console
  logs. Used for initial T0.1/T0.3 exploration (kernel version banner).
- `console-driver.js` — `runCell(page, code)` helper that types Octave into the REPL's
  console prompt and reads back output. Run directly for the T0.2/T0.3/T0.5/T0.7 smoke
  tests (arithmetic, matrix ops, for-loop, function-in-cell, printf/fprintf,
  try/catch, `version()`, `evalc`, `plot`).
- `t04-harness.js` / `t04-solved-run.js` — T0.4, the harness-parity test: mounts
  `+engr183` at `/engr183` (via `jupyter_lite_config.json`, see M0-FINDINGS.md) and
  runs `engr183.runTests('unit00')` unsolved and solved.
- `t06-coldload.js` — T0.6: measures total bytes fetched and time-to-kernel-ready, both
  unthrottled and under Chrome's "Fast 3G" emulation.
- `t08-final.js` — T0.8: creates and edits a `.m` file through the real file-browser +
  editor UI (not the build-time mount) and confirms the kernel picks it up live.
- `driver-entry.js` / `t09-rawws.js` — T0.9: two different attempts to drive a kernel
  from *outside* the site's own JS bundle (a fresh `@jupyterlab/services` client, and a
  raw WebSocket to the app's own kernel id). Both fail — see M0-FINDINGS.md T0.9 for
  why, and what it means for M1.

## T1.4 (M1 kernel session wrapper spike)

Requires `octave-playground` built and served locally (`npm run build && npm run
preview -- --port 5183`), with `public/xeus/` populated (`scripts/build-kernel-assets.sh`).

- `t14-spike.js` — first pass: start the kernel, check status only.
- `t14-full.js` — start the kernel and execute `1+1`, checking real output.
- `t14-netdebug.js` — traces every `/xeus/`-ish network request/response, used to find
  two upstream `@jupyterlite/xeus` + Vite bugs (see `../src/kernel/session.ts`'s header
  comment and `../scripts/vendor-worker-assets.mjs`): a hardcoded `{type: 'module'}`
  Worker option that breaks Emscripten's `importScripts()`-based glue (patched via
  `../patches/`), and two binary assets (`libz.so`, `unpack-*.wasm`) that Vite
  references by hashed URL but never actually copies into the build output.
- `t14-harness-run.js` — the full loop: write unsolved-stub Octave source directly into
  the mounted `/engr183/assignments/unit00/` path in the kernel filesystem, then run
  `engr183.runTests('unit00')` — validates the "write dirty buffers to the VFS, then
  execute" pattern DESIGN.md §4.2 and T1.5 (file bridge) depend on.

## T1.5-T1.7 (real UI: file bridge, File Browser/Editor, Command Window/Toolbar)

Same serving setup as T1.4 above.

- `t16-app.js` — loads the real app, screenshots it once the kernel reports ready.
- `t16-runtests.js` — clicks Run Tests against the unsolved starters, checks the
  report shown in the Command Window.
- `t16-solve-all.js` — types real solutions into all three files via the actual Monaco
  editor (tab-switching included), clicks Run Tests, expects 30/30.
- `t16-persist.js` — edits a file, reloads the page, confirms the edit is still there
  (`files.ts`'s `BrowserStorageDrive`-backed persistence).
- `t16-final-screenshot.js` — same as `t16-solve-all.js`, saved for a clean reference
  screenshot rather than debugging.

Note: `files.ts`'s `buildWriteFilesCode` originally used `base64_decode` to get file
content into the kernel without Octave string-escaping issues. That approach is
abandoned — `base64_decode` is broken in this xeus-octave build (fails even round-
tripping Octave's own `base64_encode` output, confirmed directly against the kernel).
It now writes raw `uint8` byte arrays via `fwrite` instead.

- `t17-samesession.js` — runs Tests unsolved, fixes one file, runs Tests again in the
  *same* kernel session (no reload). Regression test for the Octave function-cache bug
  found while building T1.9 (see DESIGN.md T1.9) — a written file's new content is
  ignored until the stale cached function is `clear`ed.

## Plotting (checking what the system can actually render)

- `t18-plot-direct.js` — calls `plot(...)` through the real `session.execute()` and logs
  every message type that comes back. Confirms the kernel emits a `display_data`
  message that our Command Window currently just discards (only `stream`/`error`/
  `execute_reply` are handled) — not a kernel limitation, just UI not built yet.
- `t18-plot-mime.js` — same, but extracts the MIME type key: `application/vnd.plotly.v1+json`
  only, no PNG fallback. Rendering plots means pulling in Plotly.js, not embedding an image.

## Verifying the real GitHub Pages deploy (not just `npm run preview`)

Getting an actual push through `.github/workflows/pages.yml` to work surfaced three bugs
every prior script above was structurally blind to, because they all ran against
`vite preview` at the origin root with headers set directly in `vite.config.ts`. See
DESIGN.md §6 for the full writeup.

- `t19-baseurl-debug.js` — reads the `jupyter-config-data` script tag's actual content
  on the live site, to check whether the baseUrl fix took effect.
- `t19-live-check.js` — full functional check against
  `https://dinocrates.github.io/ENGR-183-Tools/octave-playground/`: load, solve all
  three files, Run Tests, check the report.
- `t20-coi-check.js` — confirms `window.crossOriginIsolated` locally after adding the
  COI service worker (should stay `true`, same as before — local already had headers).
- `t20-live-coi2.js` — navigates the live site 2-3 times in sequence, logging
  `crossOriginIsolated` each time. Shows it's `false` on first visit (before the
  service worker's self-triggered reload completes) and `true` from the second
  navigation on.
- `t20-live-realistic.js` — the realistic end-to-end check: load, wait for the
  service-worker reload to settle, *then* interact. Passed 30/30 live once, but see
  below -- turned out to be timing-dependent, not actually reliable.
- `t21-coi-sw-state.js` / `t21-coi-headers.js` — dug into a *second* live failure after
  a later deploy: `crossOriginIsolated` sometimes stayed `false` even after the
  vendored script's reload, with the service worker showing `active` but
  `navigator.serviceWorker.controller` still `false` and the main document's own
  response never getting COOP/COEP (only later subresources did). Root cause: the
  vendored script's `shouldRegister()` guard means it only ever attempts one reload
  per session; on some timing that reload doesn't land on a controlled load, and it
  then gives up silently for the rest of the session (`t21-coi-sw-state.js` shows the
  registration state, `t21-coi-headers.js` shows per-response COOP/COEP headers).
  Fixed in `index.html` with a small guarded retry: if still not isolated ~1.5s after
  load, force one more reload ourselves (once, sessionStorage-guarded so it can't loop).
- `t21-repeat-check.js` — runs 5 fresh-profile visits to the live site in a row, logging
  `crossOriginIsolated` and kernel status for each. Used to confirm the guarded-retry
  fix actually resolved the intermittency rather than just happening to pass once.

## Startup loading overlay (UX: "give it a loading bar")

- `t22-overlay-dom.js` — confirms `StartupOverlay` text is present right after load and
  gone once the kernel reports ready (DOM-text based, not a screenshot — Playwright's
  screenshot capture broke partway through this session, likely from ~40 orphaned
  `chrome.exe` processes left behind by earlier scripts whose `catch` block called
  `process.exit(1)` without `browser.close()` first; left uninvestigated rather than
  bulk-killing Chrome processes that couldn't be confidently confirmed as automation-only).
- `t22-overlay-noreapp.js` — confirms the overlay does *not* reappear after a failed Run
  Tests (a code error, tracked via `status`, is a different thing from `kernelReady`
  being false).

## Problem statement panel (T2.2)

- `t23-problem-statement.js` — confirms `ProblemStatement` renders the unit title and
  description above the editor.
- `t23-collapse.js` — clicks the panel's Hide/Show toggle, confirms the description
  text is removed/restored while the title stays visible.

## Unit index / landing page + multi-unit routing (T2.5)

Same serving setup as T1.4 above (`npm run build && npm run preview -- --port 5183`).
This ticket turned the app from a single hardcoded `unit01` page into a router: an
index screen (`src/units/index.ts`'s `import.meta.glob` auto-discovery +
`UnitIndex.tsx`) in front of the old app body (extracted verbatim into
`Playground.tsx`), switched via `?unit=` in the URL (`App.tsx`) — which incidentally
delivers DESIGN.md T4.2's deep-link mechanism as a side effect.

- `t24-unit-index.js` — loads `/`, confirms the index lists "Unit 1", clicks it,
  confirms the URL becomes `?unit=unit01` and the kernel reaches Ready, clicks
  "← All units", confirms it's back at the index with the unit param cleared from
  the URL.
- `t24b-deeplink-runtests.js` — loads `/?unit=unit01` directly (skipping the index),
  confirms Playground renders immediately, then clicks Run Tests and checks the
  harness report renders through the extracted `Playground` component exactly as
  before the refactor (0/30 against the unsolved starters — expected, since they
  raise "not implemented" errors).
- `t25-prod-verify.js` — the same index/select/back/deep-link checks as `t24*`, run
  against the live `https://dinocrates.github.io/ENGR-183-Tools/octave-playground/`
  deploy rather than local preview. Caught a real bug in `t24*`/itself: `page.
  waitForFunction(fn, { timeout })` silently treats the options object as the
  *second positional arg* (`arg`), not `options`, when `arg` is omitted — so the
  intended timeout is dropped and Playwright's actual 30s default applies instead.
  Locally this was invisible (30s was already enough), but production's slower
  first-visit kernel startup exceeded it. Fixed by passing `null` explicitly for
  `arg`: `waitForFunction(fn, null, { timeout })`.

## Plot rendering + Scratch Pad

- `t26-plot-render.js` — types a `plot(...)` call into the real Monaco editor via
  `page.keyboard.insertText()` (not `.type()` — Monaco's autoclosing-brackets
  feature intercepts individual keydown events and duplicates typed `)`/`]`/`'`
  characters, garbling anything bracket-heavy; `insertText` is paste-like and
  bypasses that), clicks Run File, confirms a `.js-plotly-plot` element renders.
  Uncovered the real message-shape bug (see `session.ts`): xeus-octave's `plot()`
  sends an *empty* `display_data` placeholder first (reserving a `display_id`),
  then the actual `application/vnd.plotly.v1+json` figure a moment later as an
  `update_display_data` with the same `display_id` — our `execute()` originally
  only handled `display_data`/`execute_result` and ignored `update_display_data`
  entirely, so every plot silently rendered as nothing. Fixed by handling all
  three message types uniformly and having `Playground.tsx` patch the existing
  output block in place when a later chunk's `displayId` matches an earlier one.
- `t27-scratch.js` — full Scratch Pad flow: index lists "Scratch Pad" separately
  from graded units, selecting it starts the kernel, Run Tests is absent (no
  rubric exists for free-play code) while Run File still works, a plot renders
  there too, an edit survives a reload, and the back button returns to the index.
  The reload check reads Monaco's live model via `window.monaco.editor.getModels()`
  rather than `.textContent` on the editor DOM — Monaco virtualizes rendering, so
  `.textContent` right after a render is unreliable and gave a false negative
  before this was found (persistence itself was fine; verified directly by
  dumping the `JupyterLite Storage` IndexedDB database's `files` store and seeing
  `scratch/scratch.m` with the saved content, before fixing the check).
- `t28-prod-plot-scratch.js` — the same plot + Scratch Pad checks as `t26`/`t27`,
  run against the live production deploy. Caught a real production-only bug:
  `sync_harness.py`'s `sync_dir()` did a full `rmtree` + `copytree` of
  `public/starters/` on every sync, which CI runs before every build -- since
  `public/starters/scratch/scratch.m` has no `engr183-harness` counterpart, it
  got silently deleted on every deploy (confirmed via `curl -I` on the deployed
  starter URL: 404). Invisible locally because local testing never re-ran
  `sync_harness.py`. Fixed in `sync_harness.py` (see its own commit) by having
  `sync_dir()` preserve named entries instead of wiping the whole destination.
  Also had to switch the plot-render check from a fixed `waitForTimeout` to
  `page.waitForSelector('.js-plotly-plot', { timeout: 20000 })`: `plotly.js-
  dist-min` is a ~1.4MB gzipped chunk fetched over the real network in
  production (vs. local disk under `npm run preview`), so a short fixed delay
  that was reliable locally intermittently missed the render in prod.

## Download (T3.2 — manual Canvas submission path)

- `t29-download.js` — edits the active file in Monaco, downloads it via "Download
  File" and confirms the downloaded content is the live edit (not the original
  starter), then downloads "Download All (.zip)" and inspects it with `jszip`
  (required directly from `node_modules` in the test script) to confirm it
  contains all three unit files, flat with no folders, including the same live
  edit in the zipped copy of the active file.

## Floating figure windows + theme (T3.1, T3.6)

- `t31-floating-figures.js` — runs code producing two separate plots (`plot(...)`
  then `figure; plot(...)`), confirms two separate `.js-plotly-plot` windows open
  (labeled "Figure 1"/"Figure 2" instead of both landing inline in the Command
  Window), confirms the Command Window's text output still shows both `disp()`
  calls with no plot content mixed in, drags the first figure by its title bar and
  confirms its position actually changes, then closes one figure and confirms only
  that one is removed.
- No dedicated theme test script -- the re-skin (T3.1) is a from-classes-only
  Tailwind change (no new components, no new state), verified by re-running the
  full existing suite (`t24*`, `t27-scratch.js`, `t29-download.js`,
  `t31-floating-figures.js`) after the change and confirming zero functional
  regressions, plus visual review via screenshots (not committed).

## Workspace panel + plot sizing/background fixes (T3.6 follow-up, T3.7)

Stephen's review of the first theme+figures pass caught two real bugs and one
missing panel:

- `t34b-sizing.js` — confirms a Figure window's plot actually fills its window
  (bounding boxes within 15px) and that Plotly's `_fullLayout.paper_bgcolor`/
  `plot_bgcolor` are genuinely `#ffffff`, not the dark app chrome showing through
  transparency. Root cause was `PlotOutput.tsx` spreading xeus-octave's own
  layout JSON (which carries an explicit pixel `width`/`height` and its own
  `plot_bgcolor`) *after* our own defaults, letting the kernel's values win;
  fixed by spreading `figure.layout` first and applying our fixed
  white/autosize choices after, so ours always wins, plus explicitly deleting
  the merged layout's `width`/`height` so `autosize`+`responsive` actually
  drive the size.
- `t34-workspace.js` — the new Workspace panel (docked under File Browser, T3.7,
  never in the original plan). Runs a plain script in the Scratch Pad
  (top-level `x`/`y`/`name` assignments plus a bare unassigned `plot(x,y)`),
  confirms the panel lists `x`, `y`, `name`, and an auto-assigned `ans` (real
  Octave behavior when a function's return value isn't captured, not a bug --
  it appeared unprompted during testing and was verified as correct rather
  than filtered out), and confirms the internal `fid`/`__ws__`/`__i__`
  bookkeeping variables used to query and write files never leak into the
  displayed table. Also confirms a graded unit (function files only) leaves
  the Workspace panel empty after Run File, matching real Octave -- calling a
  function doesn't populate the caller's base workspace with its internals.

## Second review pass: Toolbar occlusion + doubled legend (T3.6 follow-up)

Stephen caught two more issues after the first figures/theme/workspace pass:
a Figure window blocking the Toolbar, and a doubled legend on multi-trace plots.

- `t36b-rerun-debug.js` -- reproduces "re-running the same code looks weird."
  Turned out not to be a kernel/data bug at all: the Figure window's default
  spawn position (24, 24) sat directly on top of Run Tests/Run File, and a
  click there was silently intercepted by the figure window instead of
  reaching the button (`element intercepts pointer events`, straight from
  Playwright's own error). Confirmed the kernel itself behaves correctly on
  repeated runs -- closing the blocking figure first and re-running dumps a
  fresh `display_id` each time and renders fine. Fixed by starting the
  cascade past the app chrome (`x: 240, y: 90` instead of `24, 24`).
- `t37-overlap-legend.js` -- the final regression check: confirms the figure
  window no longer overlaps Run File, confirms a *direct* re-run click
  succeeds with the figure still open (proving the actual fix, not just the
  absence of overlap), and confirms exactly one legend mechanism is active
  (`annotation-text` elements only, zero native-Plotly `legendtext` nodes).
- `t37i-alltraces.js` -- the diagnostic that found the doubled-legend root
  cause: dumped every SVG `<text>` node containing "sin"/"cos" and found two
  separate pairs -- one classed `legendtext` (Plotly's own native legend)
  and one classed `annotation-text` (xeus-octave's own hand-drawn legend,
  implemented as Plotly annotations + leader-line traces, with
  `showlegend: false` set deliberately to suppress the native one
  underneath). The *first* review pass's fix for a different bug (legend
  clipped past the window edge) had forced `showlegend: true` and a custom
  `legend` position, not realizing the kernel already draws its own legend
  -- that reintroduced Plotly's native legend on top of the kernel's,
  producing the doubled/offset box. Fixed by reverting to trust the
  kernel's own `showlegend`/`legend`/`margin` entirely; the original
  clipping bug turned out to already be resolved by the first pass's
  unrelated fix (matching `FloatingFigure`'s size to the kernel's own
  560x420 canvas), so nothing else needed forcing. Kept as a diagnostic
  reference (no pass/fail assertions), matching this repo's convention for
  scripts that found a root cause (`t14-netdebug.js`, `t19-baseurl-debug.js`).
- Also fixed in `PlotOutput.tsx` while chasing this: setup and cleanup both
  independently did `import('plotly.js-dist-min').then(...)`, with nothing
  guaranteeing an old effect's `purge()` resolved before a new effect's
  `newPlot()` ran -- a figure updating twice quickly (two
  `update_display_data` messages for one `hold on` plot sequence) could in
  principle draw on top of itself before being cleared. Fixed by caching the
  resolved module at module scope so cleanup can `purge()` synchronously.

## Always-visible Figure toolbar (T3.8)

- `t39-modebar.js` -- Plotly's modebar (zoom/pan/box-select/reset/camera
  icons) defaults to hover-reveal. Moves the mouse away from the plot after
  it renders and confirms `.modebar`'s computed style is still visible
  (`display: block`, `opacity: 1`, non-zero bounding box), i.e. not waiting
  on a hover to appear. Fixed via `displayModeBar: true` in the `Plotly.
  newPlot` config, matching desktop Octave's own always-visible Figure
  toolbar.

## Reset to starter (T3.3)

- `t41-reset.js` -- edits the active file, clicks "Reset File", confirms the
  confirm dialog names the specific filename, clicks Cancel and confirms the
  edit survives, then confirms for real and checks the starter content came
  back. Edits a *second* file and confirms a per-file reset on the first
  doesn't touch it (isolation). Clicks "Reset unit", confirms the dialog
  names every file in the unit, confirms it actually resets all of them.
  Finally reloads the page and confirms the reset survived -- it's persisted
  to the browser drive via the same `UnitFiles.resetToStarter` used for
  first-visit seeding, not just in-memory state.

## Persistence warning (T3.4)

- `t43-persistence-warning.js` -- fresh visit to the index: confirms the
  warning shows, mentions the Download File/Download All buttons (R5's
  mitigation), and can *only* be dismissed by clicking "Got it" -- clicking
  the backdrop and pressing Escape both leave it up. Confirms it doesn't
  reappear after a reload once acknowledged (tracked via a `localStorage`
  flag, separate from the browser-storage drive used for file content).
- `t43b-deeplink.js` -- same, but landing directly on a unit URL (skipping
  the index) on a first-ever visit: confirms the warning still shows,
  layered above the `StartupOverlay` ("Starting Octave..." text present
  underneath at the same time), and that dismissing it doesn't disrupt the
  kernel startup already in progress.

Every script in the active regression suite (`t24*`, `t27-scratch.js`,
`t29-download.js`, `t31-floating-figures.js`, `t34*`, `t37-overlap-legend.js`,
`t41-reset.js`) now seeds `localStorage.setItem('engr183-persistence-ack',
'1')` via `page.addInitScript(...)` right after `browser.newPage(...)`, so
the new first-visit warning doesn't block clicks meant for whatever each
script actually tests. Older one-off diagnostic scripts targeting already-resolved investigations
(the `t14`-`t23` range) were left as historical record rather than
retrofitted, since they aren't re-run as part of ongoing verification.

## Canvas delivery: iframe embedding ruled out (T4.1)

Set out to verify iframe embedding works; found it's architecturally
impossible and the deploy plan changed to a new-tab link instead. These
scripts require a local fake-Canvas harness, not committed to this repo
(scratch files, built to prove the point rather than to ship):
`fake-canvas.html`/`fake-canvas-link.html` served on `localhost:8899` by a
tiny Node `http.createServer`, giving a genuine cross-origin page (different
origin than `github.io`) to iframe or link the live production site from --
same-origin nesting wouldn't have caught this at all.

- `t45-iframe.js` -- loads the fake-Canvas page, confirms the real iframe's
  origin is `github.io` (genuinely cross-origin from the `localhost` parent),
  dismisses the persistence warning inside the frame, and confirms the
  kernel reaches "Ready" -- but `window.crossOriginIsolated` is `false`
  inside the iframe, unlike a direct visit.
- `t45b-iframe-runtests.js` -- the real test: clicks Run Tests inside the
  iframe and confirms it fails with `unable to find current directory` --
  the exact filesystem bug M0/M1 found in the `comlink.worker.js` fallback
  and never fixed (only routed around, by achieving `crossOriginIsolated`
  for direct visits via the COI service worker). Proves the failure isn't
  cosmetic -- the tool's core function breaks inside a real iframe embed.
- `t45c-header-check.js` -- confirms the COI service worker itself is
  working correctly inside the iframe (registered, controlling the page),
  ruling out "the service worker doesn't run in iframes" as the cause, and
  narrowing it to the real one: `crossOriginIsolated` fundamentally requires
  the *top-level* browsing context to send COOP+COEP, which only Canvas
  itself could do and never will (too many third-party tools depend on not
  having that constraint). Compares directly against the identical check on
  a non-iframed top-level visit (`crossOriginIsolated: true` there).
- `t46-newtab-flow.js` -- the fix: simulates the revised plan, a
  `target="_blank"` link on the fake-Canvas page (not an iframe). Confirms
  the new tab is genuinely top-level (`window.top === window.self`),
  reaches `crossOriginIsolated: true`, and Run Tests produces the correct
  live rubric report with no filesystem error.
- `t46b-debug.js` -- dumps the full Command Window text from the new-tab
  flow for a direct visual confirmation: character-perfect rubric report,
  same as every other Run Tests verification this session.

## Dev/staging deploy environment

`.github/workflows/pages.yml` was rewritten to build and deploy both `main`
and `dev` on every run, publishing `dev` to a separate
`octave-playground-dev/` path so there's a real GitHub Pages environment to
test against, not just `npm run preview` (which has repeatedly missed
production-only bugs all session -- COI service worker timing, response
headers, WASM asset MIME handling). Two real issues came up getting this
working: `build-kernel-assets.sh` needs `npm ci` to have already run (its
own last step reads `node_modules/@emscripten-forge/mambajs-core`), found
by reproducing the exact CI failure locally in WSL rather than fighting
GitHub's client-rendered Actions log UI through `WebFetch`; and the
`github-pages` environment's default branch protection rule only allows the
original source branch to deploy, requiring `dev` to be added under
Settings -> Environments -> github-pages -> Deployment branches and tags.

- `t47-dev-env-check.js` -- the real verification, once both issues were
  fixed: loads `octave-playground-dev/?unit=unit01` on the live dev
  deployment (not local preview), dismisses the persistence warning,
  confirms the kernel reaches Ready, confirms `crossOriginIsolated: true`,
  and runs Run Tests, confirming a correct `0/30` for unsolved starters with
  no filesystem error -- proving the dev environment is genuinely
  functional, not just serving a 200.

## Resizable / minimizable Figure windows (T3.9)

- `t49-resize-minimize.js` -- drags the new bottom-right resize handle and
  confirms the window actually grows (both dimensions), confirms the plot
  redraws to roughly match the new window size, then drags far past the
  minimum size and confirms the clamp holds. Clicks the minimize button and
  confirms the window collapses to just its title bar and the plot content
  unmounts entirely (not just hidden). Confirms an "Expand figure"-titled
  button appears in the minimize button's place once minimized, clicks it,
  and confirms the window is restored and the plot re-renders correctly.
  Uses an XPath three levels up from the "Close figure" button to locate the
  whole window element (button -> button-group div -> title bar row -> the
  window itself) -- worth remembering if this button structure changes again,
  since getting this depth wrong silently measures the title bar instead of
  the window (exactly what happened once while writing this script).
- `t50-prod-dev-resize.js` / `t50b-prod-main-resize.js` -- the same
  resize/minimize/expand checks as `t49`, run against the live
  `octave-playground-dev/` staging deploy and then the live
  `octave-playground/` production deploy respectively, following this
  session's now-standard pattern: verify on `dev` first, merge, verify the
  same thing again on `main` post-merge.

## Resizable / collapsible layout panes (T3.10)

- `t52-panel-resize-collapse.js` -- drags the sidebar-vs-main-content
  separator (`[data-separator]`, index 1 in DOM order -- index 0 is the
  File Browser/Workspace divider nested *inside* the sidebar, which appears
  earlier in the DOM despite being visually "below" the outer one; getting
  this index wrong silently drags the wrong divider with no error) and
  confirms the sidebar actually widens. Clicks File Browser's collapse
  button, confirms the pane shrinks to header height and the file list is
  genuinely clipped out of view (checked geometrically: the file button's Y
  position falls below the collapsed pane's visible bottom edge --
  `isVisible()` alone gives a false positive here, since it doesn't account
  for a flex/overflow-clipped ancestor; confirmed visually via screenshot
  before trusting the geometric check). Confirms the expand button appears
  and restores it. Collapses Command Window and confirms Editor grows to
  fill the reclaimed space. Finally runs Run Tests after all that resizing/
  collapsing and confirms it still produces a correct report.
- Real bug caught building this: `react-resizable-panels`' `Panel` size
  props (`defaultSize`/`minSize`/`maxSize`) interpret a bare number as
  **pixels**, not percent -- percentages need an explicit string
  (`defaultSize="18"`). Passed raw numbers on the first attempt, which
  rendered a several-pixel-wide sidebar; caught immediately via a local
  screenshot before ever touching a real deploy.
- Fixed two other test scripts along the way (`t31-floating-figures.js`,
  `t33-prod-figures-theme.js`): both located the Command Window's output via
  `document.querySelectorAll('div').find(d => d.textContent === 'Command
  Window')`, which stopped matching once `PanelHeader` wrapped that label in
  a `<span>` alongside a collapse button (the header div's own textContent
  now includes the button glyph too). Fixed by querying the `<pre>` output
  element directly instead of climbing from the header text.
- `t53-prod-dev-panels.js` / `t53b-prod-main-panels.js` -- the same sidebar-
  resize/collapse/expand/Run-Tests checks as `t52`, run against the live
  `octave-playground-dev/` staging deploy and then the live
  `octave-playground/` production deploy respectively.

## Bug fix: phantom Figure windows for non-plot output

Stephen reported an empty Figure window popping up with no plot generated,
and "two or more figures doesn't work." Root-caused to the same place:
`execute_result` (fires for any unsuppressed statement, e.g. `x = 5` with no
`;`) was routed through the same code path as real plots.

- `t54-nofigure-bug.js` -- runs `x = 5\ndisp('done')`, no `plot()` anywhere,
  and confirms zero Figure windows open (this was the direct repro of the
  first symptom -- before the fix, this opened an empty "Figure 1" window
  showing "(unsupported output type: text/plain)").
- Diagnosing the second symptom took a temporary `console.log` of every raw
  kernel message type (same technique as `t26c-msgdump.js` etc. earlier) plus
  a status-polling loop, since an initial premature check (breaking out of
  its poll as soon as the `disp()` text appeared, before the kernel's
  execute_reply and React's status update had actually landed) misread a
  completing-normally run as a permanent hang. Removed the temporary logging
  before committing -- see `session.ts`'s `execute()`, no debug output left
  in the shipped code.
- `t54f-render-check.js` -- two real `plot()` calls, no unsuppressed
  statements, given a *proper* wait for status to actually reach "Ready"
  (not just for output text to appear) plus extra time for both figures'
  async Plotly render: confirms both render correctly. This is what showed
  the "two figures don't work" report didn't reproduce as an actual failure
  in isolation -- it was a premature-check artifact in the *investigation*,
  not a real bug in the two-plots-alone case.
- `t54g-textoutput-check.js` -- confirms `x = 5` (unsuppressed) now prints
  in the Command Window text, matching real Octave, with zero Figure windows.
- `t54h-combined-scenario.js` -- the realistic case: unsuppressed
  assignments interleaved with two `plot()` calls, matching how a student
  actually writes exploratory code. Confirms exactly two Figure windows (not
  more), both rendering correctly, and all the unsuppressed output correctly
  appearing in the Command Window text -- this is very likely what Stephen
  actually experienced as "figures don't work with 2+": not the plots
  themselves failing, but genuine plots buried under phantom windows spawned
  by ordinary intervening statements.
- `t56-close-cleanup.js` -- follow-up question, not a bug: does closing a
  Figure window actually free its resources, or just hide them? Confirms
  real teardown: `.js-plotly-plot`/SVG counts and total DOM node count both
  drop to zero/pre-figure levels after clicking close, not just visually
  hidden. Ties to `PlotOutput.tsx`'s cleanup calling `Plotly.purge()` on
  unmount.

## Rendering spinner for slow plots (T3.12)

- `t57-rendering-spinner.js` -- real rendering is normally too fast on
  localhost to reliably catch the spinner window in a screenshot, so this
  uses Playwright route interception (`page.route('**/plotly.min-*.js', ...)`)
  to artificially delay that network response by 3s. Confirms the spinner +
  "Rendering…" text is visible and no `.js-plotly-plot` exists yet during
  the delay, then confirms the spinner disappears once the real chart
  appears after the delay passes.

## Student-added/removed files (T3.13)

- `t59-add-remove-files.js` -- against `npm run preview` on unit01. Adds a
  file via the File Browser's "+" button, confirms it appears and becomes
  the active editor tab; confirms a duplicate name and an invalid name
  (`../evil`) are both rejected inline without reaching `Playground.tsx`;
  writes code into the new file and runs it via Run File to confirm its
  content actually reaches the kernel (not just the browser drive);
  confirms a protected file (`addTwo.m`) has no delete icon while the added
  file does; confirms Reset File is disabled while the added file is
  active (it has no starter to reset to); deletes the file via the
  confirm-dialog flow and confirms it's gone from the File Browser; adds a
  second file and confirms it survives a full page reload (directory
  rediscovery in `UnitFiles.listExtraFiles`, not a manifest file).
- `t60-prod-dev-edgecases.js` -- broader edge-case sweep against the deployed
  dev URL: invalid-name variants (leading digit, embedded space, path
  traversal, `!`, double extension, empty), blur/Escape-cancel of the add
  input, case-insensitive duplicate detection against both an extra file and
  a protected file, Cancel vs. confirm on the delete dialog, deleting a
  non-active file (active tab must stay untouched), Reset Unit leaving extra
  files alone, Scratch Pad getting the feature with no cross-unit leakage,
  and reload persistence of both an add and a delete. Caught a real bug:
  `normalizeFileName`'s already-has-`.m` check was case-sensitive, so
  `HELPER.M` got double-suffixed into `HELPER.M.m` instead of being
  recognized as a duplicate of `helper.m` -- fixed by stripping a
  case-insensitively-matched extension before re-validating.

## Octave syntax highlighting (T3.14)

- `t61-syntax-highlighting.js` -- against `npm run preview` on the Scratch
  Pad. Types a script covering a comment, a keyword (`function`/`end`), a
  number, a single-quoted string, a double-quoted string, and a transpose
  (`A'`), then reads Monaco's actual rendered token spans
  (`span[class^="mtk"]`) and their `getComputedStyle(...).color` directly --
  not a screenshot -- to confirm each category gets a color distinct from
  plain text, and specifically that `A'` renders as plain/operator text (no
  string span opened) while a real string always does. Two non-obvious
  Monaco rendering details this had to work around: adjacent
  same-token characters merge into one span (not one per identifier), and
  `.view-line` text content uses U+00A0 for spaces, not a plain ASCII
  space -- both are just how Monaco renders, discovered by dumping the raw
  DOM structure when the first version of this script mysteriously
  couldn't find lines it had just proven existed.
