# Problem (section 1, "The problem")

Reference: `lib/sections/About.svelte`, `ABOUT_UI_TIMING` (ours: `PROBLEM_TIMING`).
Screenshot: `reference-problem-about.jpg`.

Files: `src/components/sections/Problem.tsx`, `Problem.module.css`.
Copy: `PROBLEM` from `src/lib/content.ts` (two-line heading, two paragraphs).

## Anatomy

```
.problem                 flex column, height 100%; right half on desktop
  .title
    Heading (h2)         PROBLEM.heading, "H2 Large"
  .copy.section-reveal-paragraph   margin-top: auto (paragraphs sit at the bottom)
    p  paragraphs[0]     primaryCopy beat
    p  paragraphs[1]     secondaryCopy beat
  IconPlus               top [10%, 5rem], left [--offset-x, --offset-x-phone]
```

`.problem` is not positioned, so the marker resolves against the stage section (as the
reference's does).

## Layout

| | desktop (≥1024) | tablet (767–1024) | phone (≤767) |
|---|---|---|---|
| `.problem` padding-top | 2.3rem | 5.7rem | 3.3rem |
| `.problem` margin-left | `var(--offset-content)` (50%) | 0 | 0 |
| `.title` | — | margin-left 3rem | margin-top 1rem, margin-left 1.68rem |

`.problem` is `flex: 1 1 0; min-width: 0` inside the stage's flex section, so with the 50%
margin it occupies exactly the right half.

`.copy`: colour `var(--text)`; `p + p` gets `padding-top: 1.5rem` (1rem at ≤1435px). Type,
measure and wrapping come from the global `section-reveal-paragraph` (Plex Sans).

### Heading size

The reference sets 104px on desktop and leaves tablet/phone at the Heading default. Our
lines are longer ("NOBODY READS" is 12 characters against "DAOISM"'s 6), so every step is
capped by a fit term so no line leaves its column:

| width | size |
|---|---|
| ≥1024 | `min(var(--h2-large-size), (100vw - 2*--offset-x) / 2 / (chars * 0.6))` |
| 767–1023 | `min(var(--h2-size), (100vw - 2*--offset-x-phone - 3rem) / (chars * 0.6))` |
| 551–767 | same with the phone title margin (1.68rem) |
| ≤550 | Heading's own clamp (unchanged) |

`chars` = the longest heading line, computed from content and passed as a CSS variable.
92px holds from ~1366px up; at 1280 it settles near 86px, at 1024 near 68px.

## Behaviour (pure function of progress)

```
t        = isMobileTiming ? PROBLEM_TIMING.mobile : PROBLEM_TIMING.desktop
ui       = uiProgress(progress, t.window)          // raw progress: may exceed 1
beat     = isMobileTiming ? linearBeatProgress : beatProgress
heading  = beat(ui, t.beats.heading)
primary  = beat(ui, t.beats.primaryCopy)
secondary= beat(ui, t.beats.secondaryCopy)
```

- Heading: `progress = heading`, `motion = t.headingMotion`.
- Paragraphs: RevealText, `progress = primary | secondary`, `duration = t.copyDuration`,
  `progressPower` 1.14 desktop / 1.06 mobile, `offsetY 0.5em`, `offsetX 0`.
- Marker hidden when `ui <= 0.001` (desktop) or `heading < SUPPORTING_UI_REVEAL` (mobile).

Outgoing holdover: the stage keeps this section's wrapper opaque while the next section
opens and passes `1 + next progress`; the window's `hideEnd` (1.16 desktop, 1.26 mobile)
fades the UI out across that stretch. Passing the raw progress to `uiProgress` is all that
takes.

## Reduced motion

Handled by Heading, RevealText and IconPlus.
