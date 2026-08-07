# M0 Feasibility Spike — Findings

**Date:** 2026-08-07
**Environment:** Windows 11 dev machine, build performed in WSL2 (Ubuntu), kernel driven
via Playwright/Chromium against the built site served locally.

Recommendation up front (§T0.10 below has the full reasoning): **proceed to M1.** Every
hard gate passed. The two real risks that materialized (bundle size on slow connections,
and Octave version skew) already have DESIGN.md-anticipated mitigations. Two new,
previously-unknown findings surfaced — noted below — neither blocks M1.

---

## T0.1 — Stand up a bare JupyterLite + xeus-octave build

**PASS**, with an environment caveat not anticipated in DESIGN.md.

`jupyter lite build` **fails on native Windows.** `jupyterlite-xeus` extracts
`emscripten-forge-dev` conda packages that contain Unix symlinks (e.g. `zlib`'s
`lib/libz.so`); creating those requires either Developer Mode or admin privileges on
Windows, and the build fails outright without it:

```
critical libmamba Can't create '...\zlib-1.3.1-h4e94343_2\lib\libz.so'
error    libmamba Cannot find a valid extracted directory cache for 'zlib-1.3.1-h4e94343_2.tar.bz2'
```

Worked around by building inside WSL2 (Ubuntu) instead, which handles the symlinks
natively — no Developer Mode toggle needed. GitHub Actions' `ubuntu-latest` runner
(what `deploy.yml`'s template already uses) is unaffected. **Action for M1/RUNBOOK:**
document that Windows contributors need WSL2 for local builds; CI is fine as-is.

Once built in WSL2: the site served locally, an "Octave (xoctave)" kernel appeared in
the launcher, and it started successfully ("Octave is ready!" in console).

## T0.2 — Verify the kernel executes

**PASS.** Exercised via the REPL console (typed input, real execution, no shortcuts):

- Arithmetic: `a = 2 + 3` → `5`
- Matrix ops: `[1 2 3] * 2` → correct
- `for` loop with `printf`: `1 2 3` printed correctly
- File-style function defined and called in the same session: `sq(4)` → `16`
- `printf`/`fprintf`: both work
- `error()`/try-catch: `error('boom')` caught, `err.message` = `'boom'`

No failures to record.

## T0.3 — Record the Octave version

Kernel version (`version()` and startup banner): **10.3.0**
Local baseline (this machine, GNU Octave via `winget`): **11.3.0**
Target (what students install per the course README): **8.4+**

All three differ. This is R2 materializing in practice, on both sides — the kernel's
Octave isn't 8.4, and *our own dev-machine baseline* isn't 8.4 either (no direct winget
package for 8.4; would need octave.org's release archive). **Recommend downloading the
actual 8.4 Windows build before signing off M1's Goal 3** ("byte-identical to local
Octave 8.4") — this spike could only confirm "byte-identical to Octave 11.3.0."

## T0.4 — Mount and run the real harness (the critical test)

**PASS**, with a cosmetic caveat.

Mounted `testing-harness/` (containing `+engr183/`, `tests/`, `assignments/unit00/`) via
`XeusAddon.mounts` at `/engr183`. Ran `engr183.runTests('unit00')`:

- **Unsolved stubs:** 0/6, report text byte-for-byte identical to the local Octave run
  (same FAIL lines, same `-> your code raised an error: ...` messages, same score line).
- **Solved versions:** 6/6, byte-for-byte identical to local (same PASS lines, same
  "Everything passes. Nice work - you are ready to submit." message).

**Caveat:** both runs print two extra `warning()` lines *after* the report that do not
appear locally:

```
warning: default load path altered.  Some built-in functions may not be found. ...
warning: function /share/xeus-octave/pause.m shadows a built-in function
```

Cause: `runTests.m`'s `onCleanup` path-restoration (`oldPath = path(); cleanup =
onCleanup(@() path(oldPath));`) interacts with paths differently under WASM — xeus-octave
ships its own `/share/xeus-octave/pause.m`, which gets shadowed once the harness's
`addpath` calls are cleaned up. The rubric report itself (what students actually read)
is unaffected and identical either way; a *fully* strict byte-for-byte diff of the
entire stdout stream would show this. **Recommend:** wrap the cleanup in
`warning('off', 'all')`/`warning('on', 'all')`, or filter these specific warning IDs in
the console pane, before this reaches students.

**Side finding (not a harness bug, but relevant to future unit content):** Octave's
`copyfile` fails under the WASM kernel — it shells out to `cp`, and the Emscripten
sandbox has no subprocess support (`unable to start subprocess for 'cp -r ...'`). The
harness itself doesn't use `copyfile`, but any future starter code or test tooling that
uses `copyfile`/`system()` will not work in-browser.

## T0.5 — Verify `evalc` under WASM

**PASS.** `s = evalc('disp(123)')` correctly captured stdout into `s` (`s = 123`),
matching exactly how the harness uses it to suppress/capture stray student output from
missing semicolons.

## T0.6 — Measure bundle size and cold load

- **Total site on disk:** 239 MiB (`/xeus` ≈150 MiB WASM/kernel assets, `/build` ≈68 MiB
  JupyterLab JS chrome, `/extensions` ≈21 MiB). The `/build` number is inflated by
  shipping the full JupyterLab/Notebook UI, which M1's minimal Vite shell won't ship.
- **Actual bytes fetched for a cold load through kernel-ready** (REPL app):
  **~58–60 MiB.**
- **Time to kernel-ready:**
  - Desktop broadband (unthrottled, localhost): **~7.9s**
  - Chrome DevTools "Fast 3G" (1.6 Mbps↓/750 Kbps↑/150ms latency): **~80.4s**

This **exceeds DESIGN.md's own 30s flag threshold by a wide margin.** Per §5's existing
guidance, this confirms R3 and means the Canvas embedding strategy should be **lazy-load
behind a click, not an autoloading iframe**, for any student on a slow connection — no
new decision needed, just execute on the plan already written.

## T0.7 — Test plotting

**PASS.** `plot([1 2 3], [4 5 6]); xlabel('x'); title(...)` rendered a real, interactive
Plotly-based line chart in the browser (axes, ticks, and title all correct — confirmed
visually via screenshot, not just "didn't error"). xeus-octave ships `jupyterlab-plotly`
as its graphics backend under Emscripten.

**R4 is resolved: plotting works.** Units 8–14 are not blocked. Only a single basic
`plot()` call was tested — a follow-up smoke test across `subplot`, `hold on` with
multiple series, 3D plots, and image display is worth doing before fully committing that
content, but the core question (does plotting work under Emscripten *at all*) is
answered: yes.

## T0.8 — Verify the contents drive reaches the kernel filesystem

**PASS, cleanly — no R6 fallback needed.**

Created a `.m` file (`bridgeTest.m`, returning `4242`) entirely through the browser's
file-browser + text-editor UI — not the build-time mount used for T0.4. From an Octave
console attached to the same kernel: `bridgeTest()` → `4242` immediately, no restart, no
extra step.

Then edited the file through the same editor UI (changed the return value to `9999`) and
saved again. Called `bridgeTest()` again **from the same running kernel, no restart**:
→ `9999`. The kernel picked up the change immediately.

This is the mechanism DESIGN.md §4.1 calls "load-bearing" for the entire file-based UI,
and it works exactly as hoped. The R6 fallback (generating Octave `fopen`/`fprintf`
writes instead of relying on the contents drive) is **not needed.**

## T0.9 — Drive a kernel headlessly via `@jupyterlab/services`

**Partial / qualified finding — not a clean pass, but not a blocker either.**

A freshly-constructed `@jupyterlab/services` `KernelManager`/`KernelSpecManager`,
bundled separately and injected into an already-loaded JupyterLite page, **does not
work**: `POST /api/kernels` and `GET /api/kernelspecs` both miss the site's kernel
machinery entirely and hit the plain static file server instead (404/501 — proof they
never reached anything jupyterlite-specific). A raw WebSocket opened from outside the
page's own bundle to the exact kernel ID the app itself was using also failed to connect
(code 1006, immediate close).

**Root cause:** jupyterlite-xeus's kernel and contents machinery is wired entirely
inside the built app's own JS module closure via `@jupyterlite/services` (which itself
uses `mock-socket` for an in-memory kernel transport). It does not route through
interceptable global `fetch`/`WebSocket` calls that code outside that specific bundle
can attach to — the service worker handles some static/content requests, but not kernel
creation or messaging.

**Practical implication for M1:** DESIGN.md §4's premise — "kernels are driven directly
through `@jupyterlab/services`... no notebook UI" — is still correct, but only when
`@jupyterlite/services`' own `ServiceManager` is built as part of the *same* application
bundle, which is exactly the existing M1 plan (Vite app importing kernel plumbing
directly). It is not something a separate script can attach to after the fact from
outside. **This is a clarification, not a blocker** — `src/kernel/session.ts` should be
the first thing built and smoke-tested in M1, since it's the one piece this spike
couldn't fully validate standalone. (T0.2/T0.5/T0.7 above did confirm the kernel itself
executes correctly with zero notebook-*cell* UI involved, just not zero
JupyterLab-console chrome — that distinction is what T0.9 was narrowly unable to close.)

## T0.10 — Go/no-go

### Recommendation: proceed to M1. No scope reduction.

**Why:**
- Both hard gates passed cleanly: T0.4 (harness parity) and T0.8 (file bridge, the
  architecture's own self-described load-bearing risk).
- R4 (plotting) resolved: works.
- R6 (contents-drive bridge) resolved: works, no fallback needed.
- R1 (kernel production-readiness): kernel booted and ran the real harness correctly
  with no crashes in this spike. Not stress-tested (long sessions, large inputs,
  concurrent kernels) — normal M1-time hardening, not an M0 gate concern.
- R2 (version skew) is real and confirmed (10.3.0 kernel, 11.3.0 local baseline, 8.4
  target) but was always expected — DESIGN.md's non-goal framing (teach the portable
  subset, flag divergences) already covers it. Action item: get a true 8.4 baseline
  before signing off Goal 3.
- R3 (bundle size / cold load) is real and significant (80s on Fast 3G, well past the
  30s flag line) but DESIGN.md already has the answer on file: lazy-load behind a click
  for the Canvas embed, not an autoloading iframe.

**New findings to carry into M1/RUNBOOK (both minor, both actionable, neither blocking):**
1. Native Windows can't run `jupyter lite build` for this project (WASM package
   symlinks); use WSL2 or CI. Document this for contributors.
2. `runTests.m`'s path-cleanup prints two harmless-but-visible extra warnings under WASM
   not seen locally; suppress them before students see the console pane.

**Not carried forward as blockers, but worth knowing:** `copyfile`/`system()` don't work
under the WASM kernel (no subprocess support) — irrelevant to the current harness, but
avoid them in any future unit content or test tooling. A generic external
`@jupyterlab/services` client can't attach to a running jupyterlite kernel from outside
its own bundle (T0.9) — `src/kernel/session.ts` needs to be built as part of the real
app bundle from day one of M1, not prototyped separately first.

---

*Stopping here per DESIGN.md — this recommendation is for Stephen's decision, not a
unilateral go-ahead into M1.*
