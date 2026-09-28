# Evidence section (reference: `lib/sections/Ventures.svelte`, "Our Blog")

Files: `src/components/sections/Evidence.tsx`, `Evidence.module.css`.
Copy: `EVIDENCE` in `src/lib/content.ts` (heading, description, eight slides).
Timing: `EVIDENCE_TIMING` (= the reference's `VENTURES_UI_TIMING`, plus `slides`).

## Anatomy (reference screenshot `reference-evidence-blog.jpg`, 1512x861)

- Wrapper: `position: relative; display: flex; flex-direction: column;
  padding-top: 4.6rem; height: 100%; width: 100%`. Desktop (>=1024) adds
  `margin-left: var(--offset-content)` (50%). The stage section is a flex row,
  so the wrapper shrinks to the right half of the content box.
- Heading: `EVIDENCE.heading`, `position="bottom"` (absolute, bottom 0), so its
  left edge sits at 50% on desktop and at the content edge below 1024.
  `mobile-padded` class (1.68rem left pad <=1024). 550-612px wide: 64px in the
  reference, 58px here (Plex Mono is ~10% wider).
- Description: absolute, `top: 4rem` (phone `4.5rem`), `left: 0`; desktop
  `left: -100%` of the half-width wrapper = the viewport's left content edge.
  `line-height: 1.2`, colour `--text`, paragraph `section-reveal-paragraph`
  with a tighter `max-width: 40ch`; phone 14px / 1.4.
- IconPlus: `bottom: 3.35rem; left: 0`, hidden on desktop.
- Mobile focus badge sits inside the description block, under the paragraph
  (see `slide-focus-badge.spec.md`).
- The train (see `evidence-train.spec.md`) renders as a sibling of the wrapper,
  absolutely filling the section, painted *under* the wrapper (the reference
  draws it in WebGL beneath the DOM). The wrapper takes `pointer-events: none`
  so it never blocks the train.

## Progress wiring (section progress `p`, may exceed 1 while outgoing)

| value | reference | here |
|---|---|---|
| `sectionProgress` | `clamp01(p)` | same |
| `uiProgress` | `getUiProgress(p, timing.window)` | `uiProgress(p, window)` |
| `descOut` | `getUiProgress(p, {...window, hideStart/End: descriptionHide})` | same |
| `contentReveal` | `getBeatProgress(sectionProgress, timing.content)` | `beatProgress` |
| `contentUi` | `contentReveal * descOut` | same |
| desc `translateY` | `(1 - contentUi) * 30px` | same |

- Heading reveal progress = `uiProgress`, `from: 'start'`, motion
  `timing.headingMotion`.
- Paragraph: `RevealText progress=contentUi duration=copyDuration
  progressPower=1.18` (the reference's `scrubProgressPower`).
- IconPlus hidden: mobile timing `uiProgress < SUPPORTING_UI_REVEAL`, desktop
  `uiProgress <= 0.001`.

Desktop timing: window 0.12 / 0.32 / 0.86 / 1.12, content 0.25-0.35,
descriptionHide 0.78-1.04, slides 0.30-0.86. Mobile: window 0.10 / 0.34 /
0.86 / 1.10, content 0.30-0.44, descriptionHide 0.80-1.04, slides 0.34-0.86.

## State

- `focusedIndex` (hysteresis index from the train) lifts to the section so the
  badge and the train share it.
- `trainVisible` gates the badge (the reference shows the badge only while the
  slider group is visible).

## Rebrand notes

- Red → `--accent`; text on it `--on-accent`.
- "Our Blog" → "The evidence"; blog-post image slides → evidence cards.
- Everything else (positions, beats, 30px rise, 40ch measure) is the reference's.
