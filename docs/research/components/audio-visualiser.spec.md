# Audio visualiser (the "Ambient / Sound off" pill)

File: `src/components/chrome/AudioVisualiser.tsx` + `AudioVisualiser.module.css`.
API: `AudioVisualiser({ mobileHidden?: boolean })`.

## Placement (reference)

Desktop (>1024px): `position: fixed; top: 1.2rem; z-index: 99`, and
`left: calc(50% + 23.5rem / 2 + 6px)`. The tick ruler is a fixed 23.5rem ×
2rem bar centred at `left: 50%` with `top: 1.2rem`, so the pill's left edge
sits 6px right of the ruler's right edge and both share the same top and
height. Measured on `reference-hero.jpg` (scaled ×0.963): ruler 547→908px,
pill 915→1073px, i.e. 950→1114px at 1512 wide. The width is fixed through a
custom property `--tick-ruler-width` (fallback 23.5rem) so the ruler can
share it.

≤1024px: the reference renders the same component inside a fixed
`.mobile-dock` (left/right 0.625rem, bottom 1.25rem, z-index 101, flex,
`space-between`, `pointer-events: none`) next to the scroll tracker. Here the
foreman owns that dock; the pill is `position: relative` so the dock places
it, and it keeps `z-index: 101`.

## Anatomy, desktop

One `<button>` (`aria-pressed` = sound audible) holding a 2rem-high chrome:

- **chrome**: flex row, radius 0.42rem, overflow hidden, 1px border
  grey(168,174,188)/0.26, vertical gradient (49,51,57)/0.96 → (28,30,35)/0.98,
  shadow `0 .8rem 2rem` black/0.2 and a 1px inner top highlight.
- **scope** (5.2rem wide): a glow layer (accent radial at 25% 50%, a white
  sheen, blur 2px, opacity 0.7, shifted −12%; on hover opacity 1, shifted
  +10%, no blur), then the canvas (dark inset gradient, 0.5px border, radius
  4px), then a volume readout `NN%` (0.52rem, tabular, bottom-right) shown on
  hover and while dragging.
- **meter**: 2px accent bar at the bottom, `scaleX(volume)`, only while
  dragging.
- **meta** (min-width 5rem, padding 0 .62rem 0 .52rem, left divider): a row
  with a 0.24rem accent dot (glow, 2.4s pulse) and the kicker
  `HEADER.soundKicker` (0.48rem, tracking 0.18em, uppercase, white/0.52), and
  the state line `HEADER.soundOn`/`soundOff` (0.68rem, white/0.96, mono word
  spacing). When off the dot is white/0.4 with no glow and no pulse.
- Hover (fine pointers): lift 1px (280ms), brighter border and deeper shadow.

## Anatomy, ≤1024 (the dock button)

- 3rem circle, 1px border grey/0.42, background: accent radial glow from the
  bottom over a dark → deep-accent vertical gradient; drop shadow, inner top
  highlight and an inner accent glow at the bottom.
- Off: border grey/0.38, plain dark gradient, no accent.
- A ring (`::before`, inset −7px, white/0.12) that scales 0.88 → 1 and fades in
  on hover / focus-visible, with the button scaling to 1.08.
- Content: only the canvas, 42 × 18px (16px tall ≤390px). The meta text is
  kept but visually hidden so the button keeps its accessible name.

## Canvas drawing

A dot matrix: dots of radius 1.35px on a 5.2px pitch. Columns span the width;
each column samples the analyser's time-domain data at its x, turns the
deviation from 128 into a height through a soft-knee curve
`1 − e^(−k·amp)`, gates tiny values, and stacks dots up and down from the
midline. All dots go into one path and are filled once.

| | desktop | dock |
|---|---|---|
| knee k | 18 | 34 |
| reach (× half height) | 0.9 | 1.4 (capped at the edge) |
| gate | 0.012 | 0.004 |
| extra gain | — | ×2.3, plus a slow ±0.03 drift while on |
| colour on | accent 0.94, accent glow 0.22 blur 7 | accent 0.98, no blur |
| hover | white 0.94, white glow 0.26 blur 10 | — |
| colour off | accent 0.32, no glow (a faint flat row) | grey-300 0.92 |

Colours are read from `--accent-rgb` and `--grey-300` at mount. Global alpha
0.82 until revealed. Canvas backing store is sized at devicePixelRatio (≤2).

Loop: 30fps while sound is on, and for 1.4s after it goes off so the fade is
visible; otherwise one static frame is drawn on change and the loop stops.
It never runs while the document is hidden or while `mobileHidden` hides the
dock button.

## Interaction

- Click (or Enter/Space): toggles. If audible → `soundOn` false. Otherwise,
  if the volume is 0 it is restored to 0.6, then `soundOn` true.
- Desktop drag (pointer moves >6px after pointerdown): scrubs volume from the
  pointer's x across the pill; switches sound on if needed; the click that
  follows a drag is swallowed. On release the volume and preference are saved.
- ArrowRight/Up and ArrowLeft/Down step the volume by 5%.
- Pointerdown calls `unlockAudio()` so a drag can start sound on Safari.
- Hover plays the `hover` one-shot (mouse only).

## Reveal

Visible once `introPhase ≥ HERO_INTRO_PHASE.uiGroup` (desktop) or
`≥ HERO_INTRO_PHASE_MOBILE.scrollIndicator` (≤1024). Desktop: opacity 0 →
1 (680ms, 0.22s delay) and translateY(−10px) → 0 (680ms), ease
cubic-bezier(0.22, 1, 0.36, 1). Dock: translateY(10px) scale(0.92) → none.
`mobileHidden` fades the dock button out and makes it unfocusable.

Reduced motion: no pulse, no drift, no enter translate/scale (opacity only),
no hover lift. The canvas still follows the audio.

## Hover label and hooks

- Desktop, while hovered by a mouse: an accent chip 0.45rem under the pill
  with `HEADER.soundEnable` / `HEADER.soundMute` (0.62rem, tracking 0.12em,
  uppercase, `--on-accent` text), rising 6px and scaling 0.92 → 1 over 220ms.
  Hidden on ≤1024.
- The root carries `data-cursor-hide` (the custom cursor hides over it) and
  `data-own-keys` (the stage ignores its arrow keys, which are also
  `preventDefault`ed).
