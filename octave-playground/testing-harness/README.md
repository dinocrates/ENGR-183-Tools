# ENGR-183 — Programming for Engineers and Scientists

Course tools and assignments. Everything here runs in **GNU Octave**, which is free and open source.

---

## Unit 00 — Getting Started

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

Either clone it with git:

```
git clone <repo-url>
```

…or download the ZIP from the repository page and unzip it somewhere you will remember. Your Desktop is fine. A folder path with no spaces in it will save you headaches later.

### 3. Point Octave at the course tools

In Octave, navigate to the folder you just downloaded and run `setup`:

```matlab
cd  ~/Desktop/engr183-octave      % <- change this to wherever you put it
setup
```

You should see a confirmation message with your Octave version. **You need to run `setup` once each time you start Octave.**

### 4. Run the checker before writing any code

```matlab
engr183.runTests('unit00')
```

Everything will fail. That is correct and expected — you have not written anything yet. Read the output. Each line is one criterion from the grading rubric, and the arrow underneath tells you what went wrong.

### 5. Do the work

Open the three files in `assignments/unit00/` and replace the `error(...)` line in each with your solution:

- **`addTwo.m`** — return the sum of two numbers
- **`circleArea.m`** — return the area of a circle given its radius
- **`greet.m`** — build a greeting string

Each file has instructions and examples in its comments. Read them.

### 6. Check your work as often as you like

```matlab
engr183.runTests('unit00')
```

Run it after every change. It never submits anything, it never modifies your files, and there is no penalty for running it a thousand times. When all six criteria pass, you are done.

### 7. Submit

In Canvas, submit:

1. The three `.m` files from `assignments/unit00/`
2. A copy-paste of your final `engr183.runTests('unit00')` output
3. The version number you saw in step 1

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
