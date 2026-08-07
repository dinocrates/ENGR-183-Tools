# ENGR-183 Octave Playground — Design Document

**Status:** Draft for implementation
**Owner:** Stephen Hamrick, MSJC
**Implementer:** Claude Code
**Target repo:** `dinocrates/ENGR-183-Tools`, path `octave-playground/`
**Deploy target:** GitHub Pages, embedded in Canvas via iframe

`ENGR-183-Tools` is a monorepo hosting multiple course tools (this playground, visualizers, calculators, graphing tools). Everything below that refers to "the repo" or gives root-relative paths (`src/`, `starters/`, `.github/workflows/`, etc.) means `octave-playground/` within that monorepo, not the repo root — see §6. The multi-tool GitHub Pages layout (shared workflow, URL structure, whether tools share a build step) is an open question deferred to T1.1; M0 has no deploy step and isn't blocked by it.

---

## 1. Context

ENGR-183 (Programming with MATLAB for Engineers and Scientists) is a fully asynchronous online course. MATLAB licenses were not ordered before the term, so the course runs on **GNU Octave**. 32 enrolled, 20 waitlisted.

Students install Octave locally in Week 1. This project is **not** a replacement for that install — it is the fallback and the consistency layer:

- Students on Chromebooks, locked-down work machines, or tablets who cannot install
- Students whose install breaks mid-semester
- Embedded per-unit exercises inside Canvas pages, zero friction
- A known-good environment for reproducing "it works on my machine" reports

A working rubric harness exists at `octave-playground/testing-harness/` (`+engr183` package), verified locally under Octave 11.3.0 — not yet against the 8.4 students actually install; see M0-FINDINGS.md T0.3. **That harness is the contract.** This project wraps it in a browser runtime. It does not reimplement it. Whether it stays at this path or moves to a separate `engr183-octave` repo is still open — see §9.3.

## 2. Prior art — the CSIS-118B NASM playground

Last semester's x86-64 NASM playground is the model. Feature parity target:

| NASM playground | ENGR-183 equivalent |
|---|---|
| Browser IDE, no install | JupyterLite + xeus-octave (WASM) |
| Custom `csis118b.inc` library on include path | `+engr183` package mounted into kernel VFS |
| Preloaded starter code per assignment | Per-unit `.m` starter files seeded into the drive |
| Built-in unit tests, immediate feedback | `engr183.runTests('unitNN')` |
| MSJC branding | Custom JupyterLab theme, dark blueprint |
| GitHub Pages hosting | Same |
| — (new) | Persistence + export, reset-to-starter |

## 3. Goals and non-goals

### Goals

1. A student opens a URL and is running Octave in under 60 seconds, no install, no account.
2. Each unit opens with its `.m` starter files already present, the problem statement visible, and Run Tests working immediately.
3. `engr183.runTests('unitNN')` produces **byte-identical rubric output** to local Octave. Same harness, same result. No second standard.
4. Student work survives a browser refresh and can be exported as `.m` files for Canvas submission.
5. Embeddable in a Canvas page via iframe.
6. Instructor can add a new unit by dropping in files and rebuilding — no code changes.
7. **The browser environment matches the local one.** Students edit `.m` files, one function per file, in a unit folder — the same mental model, the same filenames, and the same files they submit to Canvas. No notebooks, no cells, no Jupyter vocabulary anywhere in the student-facing product.

### Non-goals

- **Not an autograder.** No submission, no grade passback, no LTI. Students still submit files to Canvas. Grading stays local.
- **Not an authentication system.** No accounts, no server-side state, no PII. Anonymous, client-side only.
- **Not a MATLAB emulator.** Where Octave and MATLAB diverge, we teach the portable subset and flag differences in course material.
- **Not the primary environment.** Local Octave is primary. This is the fallback.

## 4. Architecture

The student sees files. There is no notebook UI anywhere in the product.

```
GitHub Pages (static, no server)
└── engr183-playground  (Vite + TypeScript app)
    ├── UI shell
    │   ├── File tree        assignments/unit03/  →  addTwo.m, circleArea.m …
    │   ├── Editor tabs      Monaco, one tab per .m file
    │   ├── Console pane     rubric report + Octave stdout
    │   └── Actions          Run Tests · Run File · Reset · Download
    │
    ├── @jupyterlab/services  ──►  JupyterLite kernel manager
    │                               └── xeus-octave (WebAssembly)
    │                                   └── Emscripten virtual filesystem
    │                                       ├── /engr183/+engr183/   harness (build-time mount, read-only)
    │                                       ├── /engr183/tests/      specs (build-time mount, read-only)
    │                                       └── /drive/unitNN/*.m    student files (IndexedDB-backed)
    │
    └── No notebook. No cells. No Jupyter chrome.
```

We use JupyterLite for its kernel plumbing — the WASM build, the kernel lifecycle, the contents drive — and discard its frontend entirely. Kernels are driven directly through `@jupyterlab/services` by sending execute requests and reading the reply stream.

### 4.1 Why files, not notebooks

Students install Octave locally in Week 1, write one function per `.m` file, and submit those files to Canvas. A notebook UI diverges from that model in ways that surface constantly: cells are not files, cell execution order is not script order, and error messages reference cell indices that do not exist on the student's disk.

Making a notebook *look* like files was considered and rejected. A disguise has to hold everywhere — every error message, every keyboard shortcut, every autosave prompt — and the first leak costs more trust than the mismatch would have. Since the kernel already exposes a real filesystem, the files can simply be real.

This also simplifies two downstream features. **Export** becomes a direct download of the exact files the kernel ran, with no packaging step and no chance of divergence. **Reset** becomes a file copy.

### 4.2 Execution model

- **Run Tests** — write dirty buffers to the VFS, then execute `engr183.runTests('unitNN')` and stream stdout into the console pane verbatim. The rubric report is rendered as plain preformatted text, exactly as it appears in a local terminal. No re-parsing, no custom rendering, no second presentation of the same data.
- **Run File** — write dirty buffers, then execute the active file as a script for quick experimentation.
- **Kernel restart** — offered when the kernel wedges (infinite loop, `input()` call). Student files are untouched by a restart because they live in the contents drive, not kernel memory.

## 5. Technology decisions

| Decision | Choice | Rationale |
|---|---|---|
| Runtime | `xeus-octave` compiled to `emscripten-wasm32` | Only maintained path to real Octave in-browser |
| Frontend | Vite + TypeScript, Monaco editor | Matches the existing visualizer suite stack; full control over the file-based UI |
| Kernel plumbing | JupyterLite + `@jupyterlab/services` | Kernel lifecycle and contents drive without the notebook frontend |
| Package source | `emscripten-forge-dev` + `conda-forge` | Where the WASM build is published |
| Build tool | `jupyterlite-xeus` (PyPI, 4.0.5) | Handles env solve + VFS mounting |
| Hosting | GitHub Pages via Actions | Matches existing course tooling |
| Persistence | JupyterLite contents drive (IndexedDB) | No server; accept the limits, mitigate with export |

### Known risks — read before starting

**R1 — the WASM kernel may not be production-ready.** `xeus-octave` for `emscripten-wasm32` sits at 0.6.2 on the **dev** channel (`emscripten-forge-dev`), and the listing was roughly nine months stale when surveyed. It is not on the stable channel. This is the single largest risk in the project and is why M0 exists as a hard gate.

**R2 — Octave version skew.** Students install Octave 8.4+ locally. The WASM build is whatever version xeus-octave pinned. If the harness or student code hits a behavioral difference, the "identical output" guarantee in Goal 3 breaks. M0 must record the WASM Octave version and diff it against 8.4.

**R3 — bundle size and first load.** A full Octave WASM build is large. On a phone or rural DSL this could be a multi-minute first load. Measure it in M0; if it's bad, that changes the Canvas embedding strategy (lazy load behind a click, not an autoloading iframe).

**R4 — plotting is unproven.** Native Octave graphics under Emscripten may not work at all. Units 8+ involve plotting. If plots don't render, this playground cannot cover the back half of the course and its scope narrows to Units 0–7.

**R6 — the contents-drive-to-kernel bridge is load-bearing.** The file-based design assumes files written to the JupyterLite contents drive are visible to the xeus-octave kernel's filesystem. If that bridge does not work, every student edit must instead be pushed into the VFS by generating and executing Octave file-writing code before each run — workable, but slower and more fragile. Verify in M0 (T0.8).

**R5 — IndexedDB is not durable.** Clearing browser data destroys student work. Mitigated by prominent export, never by promising persistence.

### Fallbacks if M0 fails

- **F1:** Server-side Octave via JupyterHub/Binder. Real infrastructure cost and maintenance, but a known-good runtime.
- **F2:** Ship local Octave only. The harness already works today; this project is shelved. Acceptable outcome — the course is not blocked on it.
- **F3:** Raw `rwl/octave-wasm` with a custom Vite shell. Much more work, no Jupyter layer, but full control.

## 6. Repository layout

This project lives at `octave-playground/` inside the `ENGR-183-Tools` monorepo, alongside sibling tools (visualizers, calculators, graphing tools — each in their own top-level folder). Everything below is relative to that folder:

```
ENGR-183-Tools/
└── octave-playground/
    ├── .github/workflows/deploy.yml     # build + publish to Pages — scoped to this path; see §3 note on multi-tool Pages layout, deferred to T1.1
    ├── environment.yml                  # kernel env spec
    ├── jupyter_lite_config.json         # mounts, addon config
    ├── src/                             # the Vite + TS application
    │   ├── main.ts
    │   ├── kernel/                      # @jupyterlab/services wrapper
    │   │   ├── session.ts               # start, restart, execute, stream stdout
    │   │   └── files.ts                 # contents drive <-> editor buffers
    │   ├── ui/
    │   │   ├── FileTree.ts
    │   │   ├── EditorTabs.ts            # Monaco
    │   │   ├── Console.ts
    │   │   └── Toolbar.ts
    │   └── theme/                       # MSJC dark blueprint tokens
    ├── starters/                        # seed files copied into the drive per unit
    │   └── unit00/  addTwo.m  circleArea.m  greet.m
    ├── units/                           # per-unit metadata + problem statements
    │   └── unit00.json
    ├── vfs/                             # build-time mount into kernel FS
    │   └── engr183/
    │       ├── +engr183/                # harness — VENDORED, see below
    │       └── tests/
    ├── scripts/
    │   ├── sync_harness.py              # pull harness from engr183-octave
    │   └── new_unit.py                  # scaffold a unit
    └── DESIGN.md
```

Note: `.github/workflows/` for a single tool inside a monorepo normally lives at the repo root (GitHub only triggers workflows defined there), scoped with a `paths:` filter on this folder. It's placed here for readability; T1.1 should move the actual YAML to `ENGR-183-Tools/.github/workflows/` when the multi-tool CI story is settled.

Note the split between `vfs/` and `starters/`. The harness and test specs are **build-time mounts** — read-only, identical for every student, never editable. Starter files are **seeds** copied into the student's writable contents drive on first visit to a unit. Students can break their own files freely; they cannot break the harness or edit the tests.

**On vendoring the harness:** `vfs/engr183/` is a *copy* of the `engr183-octave` repo, synced by script, never hand-edited. The source of truth is `engr183-octave`. If the two drift, students get different rubric results in browser vs. local, which destroys the core guarantee. `sync_harness.py` must fail loudly on local modification.

## 7. Milestones

- **M0 — Feasibility spike (GATE). DONE.** Prove the kernel works. See `M0-FINDINGS.md` — recommendation: proceed to M1, no scope cuts.
- **M1 — Minimum viable playground (in progress).** One unit, harness running, deployed.
- **M2 — Course content.** All units, scaffolding tooling.
- **M3 — Student experience.** Persistence, export, reset, branding.
- **M4 — Canvas integration.** Embedding, per-unit deep links.

---

## 8. Tickets

### M0 — Feasibility spike (GATE) — DONE

> **Do not start M1 until M0 is complete and the go/no-go is recorded.** Every downstream ticket assumes the kernel works. If it doesn't, we want to know in a day, not a fortnight. Timebox: 1 day.

**Complete — see `M0-FINDINGS.md` for the full per-ticket writeup.** T0.1–T0.9 all done; recommendation is to proceed to M1 with no scope reduction. Two new, non-blocking findings surfaced: native Windows can't run the build (needs WSL2/CI), and the harness prints two extra cosmetic warnings under WASM worth suppressing.

**T0.1 — Stand up a bare JupyterLite + xeus-octave build**
Build locally from the `jupyterlite/xeus-lite-demo` template. `environment.yml` targets `emscripten-forge-dev` and `conda-forge`, dependency `xeus-octave`.
*Acceptance:* `jupyter lite build` completes; site serves locally; an Octave kernel appears in the launcher.

**T0.2 — Verify the kernel executes**
Exercise: arithmetic, matrix ops, a `for` loop, a `function` defined in a file, `printf`/`fprintf`, `error()` and try/catch.
*Acceptance:* All execute correctly. Record failures verbatim in `M0-FINDINGS.md`.

**T0.3 — Record the Octave version (R2)**
Run `version()` in the kernel.
*Acceptance:* Version recorded in `M0-FINDINGS.md` alongside the locally-installed 8.4. Note any major-version gap explicitly.

**T0.4 — Mount and run the real harness (the critical test)**
Mount `+engr183`, `tests/`, and `assignments/unit00/` via `--XeusAddon.mount`. Run `engr183.runTests('unit00')` with (a) unsolved stubs and (b) correct solutions.
*Acceptance:* Report output is **character-for-character identical** to local Octave 8.4 for both cases. Any diff is documented. This ticket is the whole project in miniature — if it fails, nothing else matters.

**T0.5 — Verify `evalc` under WASM**
The harness depends on `evalc` to capture student stdout. Confirm it captures output and assigns results in the kernel.
*Acceptance:* Confirmed working, or documented as broken with a proposed workaround.

**T0.6 — Measure bundle size and cold load (R3)**
Total deployed size; cold-load time on throttled Fast 3G and on desktop broadband.
*Acceptance:* Both numbers in `M0-FINDINGS.md`. Flag if cold load exceeds 30s on throttled.

**T0.7 — Test plotting (R4)**
`plot([1 2 3],[4 5 6])`, `figure`, `xlabel`, `hold on`. Try any available graphics toolkits.
*Acceptance:* Documented as working, partially working, or broken. If broken, note that project scope narrows to Units 0–7.

**T0.8 — Verify the contents drive reaches the kernel filesystem (R6)**
Write a `.m` file through the JupyterLite contents API, then from the kernel confirm the file exists, is on the path, and is callable. Then modify it and confirm the kernel sees the new version without a restart.
*Acceptance:* Round trip works, or documented as broken with the fallback (generate Octave `fopen`/`fprintf` writes) costed out. This gates the entire file-based UI.

**T0.9 — Drive a kernel headlessly via `@jupyterlab/services`**
Minimal script: start a kernel, send an execute request, capture the stdout stream. No notebook UI involved.
*Acceptance:* Arbitrary Octave executes and stdout is captured programmatically. This proves the notebook frontend is genuinely optional.

**T0.10 — Go/no-go writeup**
Summarize T0.1–T0.9 into a recommendation: proceed to M1, proceed with reduced scope, or fall back to F1/F2/F3.
*Acceptance:* `M0-FINDINGS.md` ends with an explicit recommendation and rationale. **Stop here and wait for Stephen's decision.**

---

### M1 — Minimum viable playground

**T1.1 — Repo scaffold and CI**
Layout per §6, under `octave-playground/` in the `ENGR-183-Tools` monorepo. Vite + TypeScript app. Decide and implement the multi-tool Pages strategy: a workflow at the monorepo root, `paths`-filtered to `octave-playground/**`, that builds this tool into its own subdirectory of the published site (e.g. `/octave-playground/`) without clobbering sibling tools' output.
*Acceptance:* Push to main touching `octave-playground/**` publishes a working site at `<pages-url>/octave-playground/`, and does not disturb other tools already on Pages.

**T1.2 — `sync_harness.py`**
Copies `+engr183/` and `tests/` from the `engr183-octave` repo into `vfs/engr183/`, and `assignments/` into `starters/`. Records source commit SHA in `vfs/engr183/HARNESS_VERSION`. Refuses to overwrite locally-modified files without `--force`.
*Acceptance:* Sync works; drift is detected and reported; SHA recorded.

**T1.3 — Pin the kernel environment**
Lock exact versions in `environment.yml`. Do not float on a dev channel — a silent upstream change must not break the course mid-semester.
*Acceptance:* Two builds a week apart produce the same kernel version.

**T1.4 — Kernel session wrapper (`src/kernel/session.ts`)**
Start a xeus-octave kernel via `@jupyterlab/services`. Expose `execute(code)` returning streamed stdout/stderr, plus `restart()`. Handle kernel-not-ready and kernel-died states with actionable messages.
*Acceptance:* Unit-testable module; arbitrary Octave runs and returns output; restart recovers a wedged kernel.

**T1.5 — File bridge (`src/kernel/files.ts`)**
Read and write `.m` files through the contents drive. Seed a unit's starters on first visit. Track dirty buffers and flush them before any execution. Implements the R6 fallback path if T0.8 failed.
*Acceptance:* A file edited in the browser is what the kernel executes, every time, with no manual save step.

**T1.6 — File tree and editor tabs**
Monaco with Octave/MATLAB syntax highlighting. Tree lists the current unit's `.m` files. Tabs, dirty indicators, keyboard save.
*Acceptance:* A student can open, edit, and switch between the three Unit 00 files.

**T1.7 — Console pane and Run Tests**
Toolbar button executes `engr183.runTests('unitNN')`. Stdout renders as monospace preformatted text, unmodified. Also wire Run File.
*Acceptance:* Rubric report in the browser is **character-for-character identical** to the same report in a local terminal.

**T1.8 — Unit 00 end to end**
Wire the existing Unit 00 starters and specs through the whole stack.
*Acceptance:* A student opens the URL, edits three files, clicks Run Tests, and reaches 30/30 without ever seeing a notebook, a cell, or the word Jupyter.

**T1.9 — Harness-parity smoke test in CI**
CI runs `runTests('unit00')` under headless local Octave and asserts the output matches a committed golden file.
*Acceptance:* CI fails if harness output changes unexpectedly. This is the guardrail on Goal 3.

### M2 — Course content

**T2.1 — `new_unit.py` scaffolder**
Generates `units/unitNN.json` (title, problem statement, file list), `starters/unitNN/` stubs, and `tests/unitNN_tests.m` from a template.
*Acceptance:* `python scripts/new_unit.py 03 --functions foo,bar` produces a working unit skeleton requiring no app code changes.

**T2.2 — Problem statement panel**
Render each unit's prose from `units/unitNN.json` beside the editor. This replaces what a notebook's markdown cells would have carried.
*Acceptance:* Problem statement is readable alongside code without switching context; collapsible at narrow widths.

**T2.3 — Author Units 01–07**
Following the 15-unit course plan.
*Acceptance:* Each unit loads, starter code runs, tests execute. Content review is Stephen's, not Claude Code's.

**T2.4 — Units 08–14, contingent on T0.7**
Only if plotting works. Otherwise raise for a scope decision.
*Acceptance:* Same as T2.2, or a written scope-change proposal.

**T2.5 — Unit index / landing page**
Table of contents linking each unit, with a short description and what it covers.
*Acceptance:* Landing page is the iframe target and links every published unit.

---

### M3 — Student experience

**T3.1 — MSJC dark blueprint theme**
Theme the app to match the existing course tool aesthetic (see the recursion visualizer and PHY-201 simulations for the established palette). Blueprint-derived: dark ground, cyan/white technical linework, monospace for code, restrained.
*Acceptance:* File tree, editor, console, and toolbar are themed coherently. Legible at Canvas iframe widths. Meets WCAG AA contrast.

**T3.2 — Download files**
Download the active file, or the whole unit as a zip, for Canvas submission. These are the exact bytes the kernel executed — no packaging, no transformation.
*Acceptance:* Downloaded files run unmodified under local Octave 8.4.

**T3.3 — Reset to starter**
Per-file and per-unit restore from `starters/`, with confirmation naming what will be lost.
*Acceptance:* Reset restores starters without touching other units' or other files' work.

**T3.4 — Persistence warning (R5)**
Prominent, non-dismissable-on-first-visit notice that work lives in browser storage and clearing data destroys it. Direct, not alarming — follow the empty-state and error-copy conventions: say what happens and what to do about it.
*Acceptance:* Visible before a student invests work. Copy reviewed by Stephen.

**T3.5 — First-run onboarding**
Brief orientation on first visit: where the files are, what Run Tests does, how to read the rubric report, how to download work for submission. Frame it in the same vocabulary the course uses locally — files and functions, not cells and kernels.
*Acceptance:* A student who has only ever used local Octave can complete Unit 00 unaided and recognizes everything they see.

---

### M4 — Canvas integration

**T4.1 — Iframe embedding**
Verify the site loads in a Canvas iframe. Check frame-ancestors headers, storage partitioning, and third-party cookie behavior — browser storage inside a cross-origin iframe is a common failure point and may interact badly with R5.
*Acceptance:* Loads and persists inside a real Canvas page. Any storage caveat documented.

**T4.2 — Per-unit deep links**
URL parameters that open directly to a given unit.
*Acceptance:* `?unit=03` opens Unit 03 directly.

**T4.3 — Mobile and small-viewport pass**
Usable at Canvas iframe dimensions and on tablets.
*Acceptance:* No horizontal scroll; controls reachable; text legible.

**T4.4 — Instructor runbook**
`RUNBOOK.md`: adding a unit, syncing the harness, rolling back a bad deploy, what to tell a student whose work vanished.
*Acceptance:* Stephen can add a unit from the runbook alone.

---

## 9. Decisions needed from Stephen

1. ~~**Notebook cells vs. file-based editing.**~~ **RESOLVED — file-based.** Students have zero tolerance for divergence from the local workflow, so the notebook layer is dropped entirely rather than disguised. See §4.1. This raises M1 cost meaningfully; see §11 for the interim plan.
2. **Scope if plotting fails (R4).** Units 0–7 only, or invoke a fallback?
3. **Repo split.** Keep `engr183-octave` (harness) and `engr183-playground` separate with a sync script, or merge into a monorepo? *Recommendation: separate — the harness must stay usable by students who never touch the browser.*
4. **Theme reuse.** Should the theme derive tokens from the existing visualizer suite's design system, or stand alone?

## 10. Interim coverage while M1 is built

The file-based frontend is more work than a stock JupyterLite deploy, and it will not be ready in Week 1. Meanwhile a handful of students — realistically two or three out of 32 — will fail to install Octave locally and need something immediately.

Plan:

1. **Week 1 diagnostic.** Unit 00 submissions identify exactly who cannot install. Handle them individually first: most install failures are fixable in one message.
2. **Unbranded stopgap, if needed.** A stock JupyterLite deploy with the harness mounted can be stood up in hours from the M0 spike artifacts. Share it privately with affected students as a temporary workaround, explicitly labeled as such.
3. **Do not launch the stopgap course-wide.** Showing 32 students a notebook interface, then replacing it mid-semester with a file interface, creates exactly the mismatch this design exists to avoid. The stopgap is triage for a named handful, not a product.
4. **Ship M1 when it is genuinely ready**, and migrate the stopgap users over.

## 11. Appendix — verified facts

Confirmed during design research (August 2026):

- `xeus-octave` is published for `emscripten-wasm32` on `emscripten-forge-dev`, latest **0.6.2**, GPL-3.0-only.
- `jupyterlite-xeus` **4.0.5** on PyPI; requires JupyterLab ≥ 4.0.0. Install via conda/mamba, or pip with micromamba 2.0.5.
- `--XeusAddon.mount` takes `host_path:vfs_path` pairs to copy files into the kernel VFS.
- `environment.yml` channels: `https://prefix.dev/emscripten-forge-4x` and `https://prefix.dev/conda-forge`.
- Blocking stdin supported from `jupyterlite-xeus` v4.0.0a8 with JupyterLite 0.6.0.
- Template repo: `jupyterlite/xeus-lite-demo` (GitHub Pages quickstart).
- Upstream caveat: adding custom conda packages is documented as supported for `xeus-python`; other kernels may be more limited. File mounting is separate and should be unaffected.

Resolved by M0 (see `M0-FINDINGS.md` for full detail):

- **R6/T0.8 — contents drive → kernel filesystem:** confirmed working, both directions, live, no kernel restart needed. No fallback required.
- **T0.9 — driving a kernel with no notebook frontend:** confirmed the kernel itself needs zero notebook-*cell* UI, but a generic external `@jupyterlab/services` client can't attach to a running kernel from outside the site's own JS bundle — `@jupyterlite/services` must be part of the same app bundle M1 builds (as already planned).
- **R2/T0.3 — kernel Octave version:** 10.3.0, vs. 11.3.0 on the dev machine used for local comparison, vs. 8.4+ students actually install. A true 8.4 baseline is still outstanding — action item before signing off Goal 3.
- **R4/T0.7 — graphics under Emscripten:** confirmed working (Plotly-backed `plot()`, verified visually). Units 8+ are not blocked. Only basic line plots tested so far; `subplot`/`hold on`/3D/image display are unverified.

Confirmed by direct testing (`octave-playground/testing-harness/_verify/run.m`, local Octave 11.3.0, and in-kernel via M0's T0.4):

- The `+engr183` harness passes and fails correctly for the solved and unsolved cases, with byte-identical report output between local Octave and the WASM kernel.
- `evalc` captures student stdout while assigning results — used to stop missing semicolons flooding the rubric report. Confirmed under both local Octave and the WASM kernel (T0.5).
- `onCleanup` path restoration works, but under the WASM kernel it also triggers two extra `warning()` lines not seen locally (xeus-octave's own `pause.m` gets shadowed during cleanup) — cosmetic, not tested locally, see M0-FINDINGS.md T0.4 for the fix.
- **Not yet verified:** the wrong-answer, missing-file, unset-output, and syntax-error report paths (`compare.m`/`runTests.m` support them structurally, but only the solved/unsolved paths have actually been exercised). Worth a quick pass before M1 ships Unit 00.
