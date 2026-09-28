# GetIt (section 6, "Get it")

Reference anatomy: `lib/sections/Team.svelte` (+ `vacancies`). Timing:
`GET_IT_TIMING` (= TEAM_UI_TIMING). Copy: `GET_IT`.

Files: `src/components/sections/GetIt.tsx` + `GetIt.module.css`,
`src/components/getit/useStepStrip.ts`.

## Departures from the reference (content needs them)

1. The heading does **not** hide on `headingHide`: heading progress is
   `beatProgress(p, headingReveal)` only.
2. The step cards show on desktop too. The reference hands desktop to 3D
   hotspots and hides its card strip; its strip logic is enabled here.
3. The warning panel (`warning-panel.spec.md`) is shown whenever the cards are.
4. Passed cards sit *under* the incoming one (z-index rises with the index).
   The reference's never-shown desktop strip stacked them on top, which would
   cover the active card's text.

## Progress curves

| Value | Formula |
|---|---|
| heading | `beatProgress(p, beats.headingReveal)` |
| reveal | `beatProgress(p, beats.cardsReveal)` → every card's `revealProgress` and the warning |
| activeTarget | `(steps − 1) × beatProgress(p, beats.cardsCycle)` |
| active (smoothed) | `damp(active, activeTarget, cardsSmoothingMs, dt)` in a frame loop |
| plus hidden | mobile: heading < `SUPPORTING_UI_REVEAL`; desktop: heading ≤ 0.001 |

## Layout

Root `.getIt`: relative, full size, `padding-top: var(--offset-content-top)`,
flex column.

- `.content` (desktop `margin-left: var(--offset-content)`): the heading
  (`className="mobile-padded"`), H2-large on desktop:
  `min(var(--h2-large-size), (50vw − offset-x − 1rem) / 7.8)` so the 13-glyph
  line never overflows the right half. Tablet caps the same way against the
  full width. `IconPlus top={["0","4.6rem"]} left="0" desktopHide`.
- Desktop (≥ 1025): two bottom-aligned blocks, `bottom: 2.6rem` inside the
  section (clear of the tracker at 1.2rem + 1.75rem):
  - `.stripViewport` bottom-left, `width: calc(50% − 1.5rem)`,
    `overflow-x: clip`, soft right-edge fade (mask) so cards entering from
    the right do not end on a hard cut.
  - the warning on the right half, `left: var(--offset-content)`,
    `max-width: 34rem`, above everything (`z-index: 4`).
- ≤ 1024: one block pinned to the bottom (`left/right/bottom: 0`), flex column:
  warning first, then the stacked cards. Cards stack in one grid cell
  (`grid-area: 1 / 1; align-self: end`), so the block's height is the tallest
  card and nothing overlaps the warning.

## Strip (desktop)

Slots: `flex: none; width: 24em; max-width: 32vw; margin-right: 1.5em`,
`align-items: flex-end`, `transform-origin: 75% center`.
`spacing = slot.offsetWidth + marginRight`, `drag = active × spacing`.

```
strip:   translate3d(−drag, 0, 0)
slot i:  local = max(0, drag − i × spacing);  t = min(local / spacing, 1)
         --card-x: local;  --card-scale: 1 − 0.55 t;  --card-rotate: −8° × t
         opacity 1;  z-index i + 1
```

## Stack (≤ 1024)

```
d = |i − active|
opacity = pressed ? 1 : max(0, 1 − 1.8 d)
scale   = reduced ? 1 : 1 + 0.018 × max(0, 1 − 2.5 d)² (+ 0.015 when pressed)
active  = d < 0.5 → z-index +10, pointer events on, not inert
```

Slot transitions: transform and opacity 0.18s `cubic-bezier(0.22, 0.61, 0.36, 1)`.
Slots are inert (and pointer-transparent) when invisible: all of them while
`reveal < 0.05`, and on mobile every slot but the active one.

The frame loop writes slot styles directly, stops once settled, and restarts on
new targets, press changes and resize. Reduced motion: instant, no scale bump,
no transitions.
