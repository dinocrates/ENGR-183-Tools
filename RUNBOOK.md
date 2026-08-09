# Instructor Runbook

For Stephen (or whoever's maintaining this next). Everything here is the operational
knowledge behind running ENGR-183 Tools day to day — adding units, deploying, and what
to do when something breaks. It assumes you've read `README.md`'s two-tool overview.

Quick map:
- `engr183-harness/` — source of truth for grading. Runs under plain desktop Octave.
- `octave-playground/` — browser fallback, wraps the harness in a JupyterLite/xeus-octave
  runtime. Never hand-edit `vfs/` or `public/starters/` inside it — both are generated
  from `engr183-harness/` by `scripts/sync_harness.py`.
- `.github/workflows/pages.yml` (repo root) — the only deploy path. One workflow builds
  *both* `main` and `dev` into one GitHub Pages artifact on every push to either branch.

---

## Adding a new unit

Two shapes exist in this course, and the scaffolder only knows one of them:

### Function-style units (multiple small functions — the original Unit 1 shape)

```bash
cd octave-playground
python3 scripts/new_unit.py 03 --functions sumRange,isPrime \
  --title "Loops and Conditionals" \
  --description "Practice writing loops and conditional logic."
```

This writes stubs into `engr183-harness/assignments/unit03/`, `_verify/unsolved/unit03/`,
`_verify/solved/unit03/` (placeholders — you still write the real reference solutions),
`tests/unit03_tests.m` (placeholder criteria), and `octave-playground/src/units/unit03.json`.
It prints its own next-steps when it finishes — follow them. One line in that printout is
stale: step 6 ("add the unit wherever the app's unit list lives") is no longer needed —
`src/units/index.ts` auto-discovers every `unitNN.json` via a glob import, so dropping the
file in is enough.

### Script-style units (one scalar script — the current Unit 1's actual shape)

`new_unit.py` doesn't scaffold this shape at all (it's `--functions`-only). Use the current
Unit 1 as your template instead:

- `engr183-harness/assignments/unit01/U01_OctaveSetupCheck.m` — the starter script
- `engr183-harness/tests/unit01_check.m` — the isolated-execution checker helper
- `engr183-harness/tests/unit01_tests.m` — how the checker's individual checks become
  `engr183.spec(...)` rubric lines
- `engr183-harness/_verify/{unsolved,solved}/unit01/` — the two fixtures
- `octave-playground/src/units/unit01.json` — metadata (note: no `retiredFiles` needed
  for a brand-new unit; that field only matters when you're *replacing* an existing
  unit's files and need to hide a returning student's old copies — see
  `octave-playground/DESIGN.md`'s T3.13 entry)

The one thing worth internalizing from writing `unit01_check.m`: any script your students'
code contains a `clear;` at the top, running it via a bare `eval(fileread(path))` inside
your checker will wipe the checker's *own* local variables too. The fix is a genuine
separate function call (Octave gives every function invocation its own workspace; `eval`/
`evalc` alone do not) — and nothing in that inner function's workspace can be set *before*
the line that runs the student's script, since the same `clear;` will wipe it. Build the
return value entirely from variables assigned *after* execution. `unit01_check.m`'s
`runStudentScript` local function is a working, tested reference for this pattern.

### Both shapes, from here

1. Write real rubric criteria in `tests/unitNN_tests.m` and a real reference solution in
   `_verify/solved/unitNN/`.
2. Verify locally: `octave-cli --no-gui --eval "setup; runUnitFilter='unitNN'; run('_verify/run.m')"`
   — confirms 0 (or your intended partial score) on the unsolved stub and full marks solved.
3. Once you're happy with the report format: `octave-cli --no-gui --eval "setup; regenUnitFilter='unitNN'; run('_verify/regenerate_golden.m')"`.
   **Always inspect the diff before committing it.** This is what opts the unit into
   `check_golden.m`'s CI guardrail — regenerating blindly to make a red check green
   defeats the point of having it.
4. From `octave-playground/`: `python3 scripts/sync_harness.py` — vendors the new unit's
   content into `vfs/` and `public/starters/` for local dev/preview.
5. Commit and push to `dev` first (see **Deploying**, below) — never straight to `main`.

---

## The dev/main kernel-sharing gotcha

`pages.yml` builds the WASM kernel — which bakes in `/engr183/tests/` and
`/engr183/+engr183/`, i.e. the harness itself — **only from `main`**, then copies that
same build into the `dev` deploy to avoid paying for it twice. `public/starters/` (what
seeds a student's file browser) *is* synced per-branch, so a `dev`-only harness change
shows up correctly there — but **`engr183.runTests(...)` on the deployed `dev` site will
keep running `main`'s old checker until you merge.** This isn't a bug; it's a real
consequence of the optimization. Concretely: after pushing a harness/checker change to
`dev`, you can trust the deployed dev site for everything *except* `Run Tests` — File
Browser contents, `Run File`, Reset, syntax highlighting, all genuinely test dev's app
code. `Run Tests` only becomes a meaningful check again once you merge into `main`.

---

## Local kernel-asset rebuilds

Needed whenever you change anything under `engr183-harness/` and want to test it locally
via `npm run preview` (CI always rebuilds fresh, so this is a local-dev-only concern).

Requires WSL2/Linux — `build-kernel-assets.sh` extracts emscripten-forge packages
containing Unix symlinks that native Windows can't create. From WSL, with `micromamba` on
`PATH`:

```bash
cd octave-playground
python3 scripts/sync_harness.py
BUILD_ENV_ROOT=$HOME/micromamba bash scripts/build-kernel-assets.sh   # several minutes; first run downloads ~110MB
npm run build   # do this AFTER the kernel rebuild, not before —
                 # `dist/` bakes in whatever public/xeus/ looked like at build time
```

Forgetting that last `npm run build` (or running it before the kernel rebuild finishes)
is a real trap — the app will silently keep serving the *previous* kernel/harness out of
`dist/`, and `npm run preview` will look like your harness change did nothing.

---

## Deploying

```bash
git checkout dev
git add -A   # review what's staged first
git commit -m "..."
git push origin dev
```

Wait for the `dev` deploy (GitHub Actions → the pages workflow run), then check
`https://dinocrates.github.io/ENGR-183-Tools/octave-playground-dev/`. Remember the
kernel-sharing gotcha above — don't be alarmed if `Run Tests` still looks like the old
behavior there for a harness change.

```bash
git checkout main
git merge dev --ff-only
git push origin main
```

Wait for that deploy, then check `https://dinocrates.github.io/ENGR-183-Tools/octave-playground/`
for real — this is where kernel and harness are actually in sync. Then sync `dev` back to
`main`'s tip (`git checkout dev && git merge main --ff-only && git push origin dev`) so
the two branches never drift apart.

**On the very first page load after a fresh deploy**, the app's COOP/COEP service worker
registers and triggers one involuntary reload (needed for the kernel's
`SharedArrayBuffer`-based fast path). This adds real, noticeable latency to that one
visit — don't mistake it for a hang.

---

## Rolling back a bad deploy

`git revert <bad-commit>` on `main`, then push. That triggers a normal redeploy from a
known-good state. **Don't** `git reset --hard` + force-push `main` or `dev` — both are
live, shared, currently-serving branches. Re-running an old GitHub Actions workflow run
does **not** roll anything back, either — the checkout steps use branch names (`ref: main`,
`ref: dev`), so a re-run always builds whatever those branches currently point to, not
the commit the original run built.

---

## "A student says their work is gone"

It probably is, and that's the expected worst case, not a bug: there's no server-side
storage, no accounts, nothing to recover. Their code lived in that one browser's local
storage, and clearing site data / a new browser / a new device / incognito mode all wipe
it. The Playground has no upload/import feature — if they have a previously *downloaded*
`.m` file, the only way to get it back into the editor is to open the file (Add File in
the File Browser, or just open the existing starter) and paste the content in by hand.
If they never downloaded anything, it's gone; they redo the work. This is exactly what
the first-visit persistence warning (`src/components/PersistenceWarning.tsx`) exists to
prevent — if this keeps happening, that's a signal to make the warning more prominent or
revisit its copy (`octave-playground/DESIGN.md`'s T3.4 — the wording was never formally
reviewed).

---

## Linking a unit into Canvas

**Use an "External URL" module item, or a plain link, with "Load in a new tab" checked.**
Do not use whatever Canvas's default embed/LTI flow offers for a URL — that typically
iframes the content, and iframe embedding is architecturally broken here: the kernel
needs `crossOriginIsolated`, which requires the *top-level* browsing context to send
COOP/COEP headers. Inside a Canvas iframe, the top-level context is Canvas's own page,
which doesn't (and won't) send those headers — no trick in the embedded page itself can
compensate. The failure mode if you get this wrong is silent and total: `Run Tests` fails
for every student, every time, with a filesystem error that has nothing to do with their
code. Opening in a new tab sidesteps the problem entirely (a new tab is its own top-level
context) rather than working around it. Full investigation: `octave-playground/DESIGN.md`'s
T4.1 entry.

Link students to the unit index (`.../octave-playground/`) or a specific unit's deep link
(`.../octave-playground/?unit=unit03`) — both work as new-tab targets.

---

## Troubleshooting quick reference

| Symptom | Likely cause | Fix |
|---|---|---|
| `Run Tests` on the deployed `dev` site doesn't reflect a harness change you just pushed | The dev/main kernel-sharing gotcha (above) | Merge to `main`, check there instead |
| `npm run preview` locally doesn't reflect a harness/checker change | Stale `public/xeus/` and/or stale `dist/` | Rebuild kernel assets (WSL), then `npm run build` again, in that order |
| A Playwright/smoke-test script times out on the very first request against a fresh deploy | COOP/COEP service-worker reload on cold visit | Give it more timeout headroom; retry once before treating it as a real failure |
| A struct/matrix/cell you `disp`'d or auto-displayed looks more compact in the browser than in desktop Octave | Known xeus-octave limitation (not fixable by a version bump — checked 0.6.2 through the latest 0.7.0, both native and WASM, same behavior) | Nothing to fix; documented in `DESIGN.md` and the harness README |
| `error: 'engr183' undefined` (student, desktop) | Didn't run `setup`, or ran it from the wrong folder | `cd` to `engr183-harness/`, run `setup` again |
| CI's `check_golden.m` fails after an intentional change | Golden files weren't regenerated | Run `regenerate_golden.m` for that unit, review the diff, commit |

---

## Where to look for more

- `octave-playground/DESIGN.md` — full design doc and dated ticket history; the best
  record of *why* things are built the way they are, including root-caused bugs.
- `engr183-harness/README.md` — student-facing setup and grading instructions.
- `engr183-harness/_verify/README.md` — what each verification script does.
- `octave-playground/M0-FINDINGS.md` — early spike findings (WASM/Octave quirks
  discovered before M1 build-out started).
