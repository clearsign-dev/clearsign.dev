# Ships (section 5, "How it ships")

Reference anatomy: `lib/sections/Partners.svelte`. Timing: `SHIPS_TIMING`
(= the reference's PARTNERS_UI_TIMING). Copy: `SHIPS`.

Files: `src/components/sections/Ships.tsx` + `Ships.module.css`,
`src/components/ships/useShipsColumn.ts`.

## Progress curves

All from `progress` (clamped to 0..1; the section is not an outgoing holdover).

| Value | Formula |
|---|---|
| `ui` | `uiProgress(p, timing.window)` |
| heading | `beatProgress(ui, beats.heading)` |
| paragraph | `beatProgress(ui, beats.paragraph)` |
| divider | `beatProgress(ui, beats.divider)` |
| cardsReveal | `beatProgress(p, beats.cardsReveal)` (section progress, not `ui`) |
| cardsMove | `beatProgress(p, beats.cardsMove)` |
| plus hidden | mobile: paragraph < `SUPPORTING_UI_REVEAL`; desktop: `ui <= 0.001` |

The heading/paragraph/divider hide through the window's hide beat; the cards
never hide (the stage fades the section).

## Layout

Breakpoints: desktop `min-width: 1025px` (matches `isMobileTiming`, which is
`max-width: 1024px`); tablet 767–1024; phone ≤ 767.

Root `.ships`: `position: relative; width/height: 100%; overflow: hidden`.
Desktop: `padding-left: var(--offset-content)`. Phone: `overflow: visible`.

- Heading: `Heading lines={SHIPS.heading} sup={SHIPS.sup} position="bottom"`,
  motion `timing.headingMotion`. Sits at the bottom of the right half on
  desktop, bottom-left on mobile. The `[5]` sup sits `right: 1rem`.
- `.desc` (desktop): absolute, `top: 43%`, `left: 50%`, `width: 50%`.
  - paragraph (`section-reveal-paragraph`, `--grey-300`), `margin-left: auto`,
    `padding-top: 1rem`; ≥ 2245px: `max-width: 36ch`, larger step.
  - divider: absolute top, 1px `--hairline`, `scaleX(divider)` from the right,
    `opacity: divider`. Desktop only.
  - `IconPlus top={["1rem","0.2rem"]} left="0"`; tablet: top 0, left 0.
- `.desc` (≤ 1024): `position: relative; top: 6.75rem` (phone `6rem`).
  Tablet paragraph `margin-left: 3rem`. The phone shows the same paragraph
  (ClearSign has no separate tagline), plus a `translateY((1 - paragraph) * 24px)`.

Paragraph reveal: `RevealText` with `progress = paragraph`,
`duration = timing.copyDuration`, `progressPower = 1.25`. Desktop gets the
per-character reveal (stands in for the reference's GSAP split-chars), mobile
the line reveal (RevealText picks this itself).

## Card column (`.cards`)

A sibling of `.ships`, absolute against the section's padding box.

| | desktop | ≤ 1024 |
|---|---|---|
| direction | column | row |
| position | `top: 0; left: 0` | `top: 25%` (phone `max(24%, 10.5rem)`) |
| gap | 1.25rem | 1rem |
| padding | `15svh 0 1.25rem var(--offset-x)` | `0 1rem` |
| travel | `moveY = column.clientHeight − innerHeight` | `moveX = column.scrollWidth − innerWidth` |

`transform-origin: left center`. Slots are `flex: none`.

Written each frame, directly to the DOM (no React re-render):

```
r        = reduced ? 1 : cardsReveal
revealX  = desktop ? (1 − r) × −32px : 0
revealY  = (1 − r) × 28px
tx, ty   = revealX − moveX × s, revealY − moveY × s
transform: translate3d(tx, ty, 0) scale(0.975 + 0.025 r)
opacity  = r;  filter: blur((1 − r) × 10px)
```

`s` is cardsMove damped toward its target with `timing.cardsSmoothingMs`
(`damp` from `lib/motion/progress`); reduced motion makes it instant.

The same frame loop drives each card's own reveal (see `ship-card.spec.md`).
The loop stops once every value has settled and restarts when the props,
the layout or the viewport change. Measurements re-run on `resize` and on a
`ResizeObserver` on the column.

## Reduced motion

Column fully opaque and unblurred from the start, the travel follows scroll
without smoothing, card items render in their final state, the plus marker
does not spin (IconPlus handles it).
