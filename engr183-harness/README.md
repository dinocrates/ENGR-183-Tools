# ENGR-183 — Programming for Engineers and Scientists

Course tools and assignments. Everything here runs in **GNU Octave**, which is free and open source.

---

## Unit 1 — OR-01 GNU Octave Setup and First Script

The goal of this first unit is simple: prove that Octave is installed and working on your machine, and get you used to how you will check your work all semester. The math is deliberately easy. If you find yourself stuck on the math, you have misread the problem.

### 1. Install Octave

Install **GNU Octave 8.4** or newer. Do not install "whatever version my package manager offers" — mismatched versions cause errors that look like your code is broken when it isn't.

| Platform | How |
|---|---|
| Windows | Download the installer from [octave.org/download](https://octave.org/download) |
| macOS | Download the `.dmg` from [octave.org/download](https://octave.org/download), or `brew install octave` |
| Linux | `sudo apt install octave` (Debian/Ubuntu) or your distro's equivalent |

Open Octave. You should see a window with a **Command Window** where you can type. Type this and press Enter:

```matlab
version
```

You should see a version number printed back. Write it down — you will submit it.

### 2. Get this repository

This folder (`engr183-harness/`) lives inside the `ENGR-183-Tools` repo. Either clone the whole thing with git:

```
git clone <repo-url>
```

…or download the ZIP from the repository page and unzip it somewhere you will remember. Your Desktop is fine. A folder path with no spaces in it will save you headaches later. Either way, the files you need are in its `engr183-harness/` subfolder.

### 3. Point Octave at the course tools

In Octave, navigate to the `engr183-harness` folder inside what you just downloaded and run `setup`:

```matlab
cd  ~/Desktop/ENGR-183-Tools/engr183-harness      % <- change this to wherever you put it
setup
```

You should see a confirmation message with your Octave version. **You need to run `setup` once each time you start Octave.**

### 4. Run the checker before writing any code

```matlab
engr183.runTests('unit01')
```

The three personalization checks will fail (5/8) — that is correct and expected, since the starter still has the placeholder name/date. The math and output checks already pass, because the starter's logic is complete; your job in this unit is personalizing it, not writing new code. Read the output. Each line is one criterion from the grading rubric, and the arrow underneath tells you what went wrong.

### 5. Do the work

Open `assignments/unit01/U01_OctaveSetupCheck.m`. It already runs and prints correctly — your job is to personalize it, not to write the logic from scratch:

1. Replace the `% Name:` comment placeholder with your first and last name.
2. Replace the `% Date:` comment placeholder with today's date.
3. Replace the `student_name = 'Replace with your first and last name';` line's value with your actual name.

Everything else — `course_number`, `force_N`, `distance_m`, `work_J`, `octave_version`, and the five `disp`/`fprintf` lines — is already correct. Leave it alone.

### 6. Check your work as often as you like

```matlab
engr183.runTests('unit01')
```

Run it after every change. It never submits anything, it never modifies your files, and there is no penalty for running it a thousand times.

**This checks 8 points of code readiness, not your full 10-point Canvas grade.** The remaining 2 points are for a readable screenshot and a complete submission — a human, not this script, checks those. An 8/8 here means your code is ready to submit; it is not itself the grade.

### 7. Run the script to produce your screenshot

`engr183.runTests('unit01')` checks your code — it does not run your script for its own sake. Run it yourself to see (and screenshot) the five required output lines:

```matlab
U01_OctaveSetupCheck
```

You should see exactly five lines: a confirmation line, your name, the course number, your Octave version, and the work check. That is what goes in your Canvas screenshot.

### 8. Submit

In Canvas, submit:

1. `U01_OctaveSetupCheck.m`, renamed to `U01_OctaveSetupCheck_LastName.m`
2. A screenshot of the five output lines from step 7 (readable — split across two screenshots if your display is too small for one)

The checker never uploads, submits, or grades a screenshot for you — it only tells you whether your code is ready. Renaming and attaching the file, and taking the screenshot, are still on you.

**Using the browser Playground instead of desktop Octave?** Its File Browser has an "Add File" button — create `U01_OctaveSetupCheck_LastName.m` there, paste your personalized code into it, and make it the active file before using Run File/download. `engr183.runTests('unit01')` prefers a single personalized `U01_OctaveSetupCheck_*.m` copy over the generic starter automatically, so this gets you the correctly-named file for Canvas without an extra rename step.

---

## Unit 2 — APA-02 Solar-Panel I-V Data Analysis

This unit practices whole-array thinking: every calculation operates on the full `voltage_V`/`current_A` vectors at once. **No loops, `if` statements, plotting, or file-import commands are allowed** — if you find yourself reaching for one, you are overcomplicating it.

The data is 37 real operating points from a Sandia National Laboratories reference solar-panel I-V trace.

### 1. Get the starter

Open `assignments/unit02/U02_APA02_SolarIV.m`. It already defines `voltage_V` and `current_A` — leave those two vectors alone. Your job is the 10 numbered TODOs below them.

### 2. Do the work

Work through TODOs 1–10 in order; each one builds on the variables the previous ones created:

1. `measurement_count` — confirm `voltage_V` and `current_A` have the same length.
2. `power_W` — power at every operating point.
3. `max_power_W`, `mpp_index` — the maximum power point, via `max` with two outputs.
4. `voltage_at_mpp_V`, `current_at_mpp_A` — indexed out using `mpp_index`.
5. `open_circuit_voltage_V`, `short_circuit_current_A` — approximated as `max(voltage_V)` / `max(current_A)` for this introductory pass.
6. `fill_factor` — `max_power_W / (open_circuit_voltage_V * short_circuit_current_A)`.
7. `normalized_voltage`, `normalized_current` — each vector divided by its own max.
8. `high_power_mask`, `high_power_voltage_V` — points at or above 90% of `max_power_W`.
9. `results` — a 37-by-5 matrix: `[voltage_V, current_A, power_W, normalized_voltage, normalized_current]`.
10. `fprintf` lines reporting max power, the MPP index, voltage/current at MPP, the open-circuit/short-circuit approximations, the fill factor, and the count of high-power points.

Also personalize the `% Name:` and `% Date:` comments at the top, same as every unit.

### 3. Check your work

```matlab
engr183.runTests('unit02')
```

8 automated points, same rubric-report shape as every other unit. The remaining 2 of this assignment's 10 Canvas points are manually graded for labels, units, comments, and a complete submission.

### 4. Submit

In Canvas, submit `U02_APA02_SolarIV.m`, renamed to `U02_APA02_SolarIV_LastName.m`, plus whatever else that week's Canvas page asks for (check there for the current requirements — a screenshot, written answers, etc.).

---

## How checking works, all semester

Every unit follows this same shape:

```matlab
engr183.runTests('unit07')
```

The report you get back **is** the rubric. Each `[ PASS ]` / `[ FAIL ]` line is a criterion I grade on, worth the points shown next to it. There is no hidden second standard — if it passes locally, it passes when I run it.

A few things worth knowing:

- **Some units include additional hidden criteria.** These check the same skills with different inputs, so that solutions which only work for the visible examples do not slip through. Write code that solves the problem, not code that satisfies the six tests you can see.
- **Floating point comparisons use a tolerance.** You do not need to match `pi` to the last bit.
- **If a criterion says a function was not found**, check the filename spelling and make sure the file is in the right folder. In Octave the filename must exactly match the function name.

## If something goes wrong

**`error: 'engr183' undefined`** — you did not run `setup`, or you ran it from the wrong folder. `cd` to the repo root and run `setup` again.

**`No assignment folder found`** — check the unit name spelling, and make sure you have the latest version of the repo.

**Octave will not install, or you are on a locked-down machine** — message me early in the week, not the night before it is due. There is a browser-based fallback and I will get you access.

## Notes on Octave and MATLAB

This course is taught in Octave, which is free. Nearly everything you learn transfers directly to MATLAB, which you will likely meet in industry or in later coursework. Where the two differ, I will flag it.

To keep your code portable, stick to these habits:

- Use `%` for comments, not `#`
- Use `x = x + 1`, not `x += 1`
- End functions with `end`, not `endfunction`

## Notes on the browser Playground

The browser fallback runs a real Octave engine (not a simulation), and `engr183.runTests(...)` behaves identically there — but one display quirk is worth knowing about. If you type a variable name without a semicolon to inspect it, **structs, matrices, and cells print more compactly in the browser than in desktop Octave** (missing the blank line after `varname =`, and structs skip the `scalar structure containing the fields:` line). Scalars (`a = 2.5`) print identically either way. This is a known limitation of the browser kernel, not a bug in your code, and it does not affect how `runTests` grades you — the rubric report itself is unaffected.

One more browser-only quirk, around figures: if you call `figure(N)` a second time on a figure that's already open — for example, to make sure Figure 1 is active again right before adding a second line with `hold on` — the browser Playground can occasionally (not always) freeze, with the plot stuck on "Rendering…" and the Run buttons unresponsive. This is a real bug in the browser's underlying Octave engine, not your code, and it's easy to avoid: **if a figure is already open, you don't need to call `figure(N)` again before `hold on`** — it's already the active figure, so just go straight to `hold on`. If the Playground does freeze, it will recover on its own after about a minute; reloading the page also works immediately and never loses your file edits, since those are saved separately from the Octave session.
