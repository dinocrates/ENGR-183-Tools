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
