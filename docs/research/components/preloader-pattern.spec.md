# Preloader: the lit grid

Reference: `lib/components/Preloader/BackgroundPattern.svelte`,
`backgroundPattern/engine.ts`, `backgroundPattern/worker.ts`.

Files: `src/components/chrome/Preloader/PatternCanvas.tsx` (host),
`pattern/engine.ts` (renderer, DOM-free), `pattern/pattern.worker.ts`,
`pattern/protocol.ts`, `pattern/tokens.ts`.

## Host

- One full-screen `<canvas>` (z 0, no pointer events) on the ground colour.
- Prefers a module Web Worker with an `OffscreenCanvas`, so the 3D scene's
  warm-up cannot starve it. Falls back to the same engine on the main thread
  when `transferControlToOffscreen`/`Worker` are missing, when the worker errors,
  has no 2D context, or has not said it is alive within 1.5s (the canvas is
  remounted, since a transferred canvas cannot be reused; progress resumes where
  it was). A failed hand-over (a development remount) retries on a fresh canvas.
- DPR capped at 2. ResizeObserver → resize. `pointermove` → pointer (not under
  reduced motion). `visibilitychange` pauses the loop.
- Colours are read once from `:root` (`--accent-rgb`, `--ink`, `--ground`) and
  passed in as numbers; a missing token falls back to neutral, never to a
  brand value.

## Grid

| | |
|---|---|
| cell | 18 × 10px, radius 1.5px, gap 8px both ways (pitch 26 × 18) |
| base cell | fill ink 2.5%, 1px stroke ink 18%; whole grid at 88% |
| lit area | from the top down to 68% of the height |
| area mask | `(1 − y/areaBottom)^1.45`, zero below areaBottom |
| wash | two radial ellipses of ink: centre (.5w, .3h) radii (.52w, .5h) at 4%; centre (.5w, .44h) radii (.96w, .88h) at 2.5%; stops 0 → 1, .7 → .34, 1 → 0 |

## Accent layer ("rows glow at the end")

- Each cell: vertical gradient accent 22% → 60%, 1px stroke of accent mixed
  toward ink at 26%. Alpha per cell = area mask × random depth (.42–1) × .84 ×
  noise, where noise = `1 − .4 + .4·n`, n = 4-octave value noise at
  (8·x/w, 2.5·y/areaBottom), contrast 1.6 about .5. Baked once per resize.
- Revealed by a vertical gradient mask whose soft edge (136px, or 3.4·pitchY)
  rises as progress rises: edge target
  `areaBottom − (areaBottom + 68) · easeInOutSine(p/100)`; the drawn edge
  follows with a 340ms exponential lag, capped at 760px/s. Accent shows
  below the edge, so rows light from the bottom of the lit area upward.
- Filled when the value is 100 and the edge is within ¼ pitch of its target:
  the lit state is baked into one bitmap and **held** behind the gate (the
  screenshot's final state). The source's post-fill drain is not reproduced,
  because the screenshot shows the rows still lit at the gate.

## Loading bar

2px at the very bottom edge, width = value%, accent, glow accent 50% blur 10px.
Fades across 99 → 100.

## Pointer trail

Cells within 72px of the pointer take a highlight (fill ink-tinted accent 16%,
stroke 85%) with smoothstep falloff × area mask, max alpha .3; intensity decays
with a 460ms time constant; stamps are interpolated along the path every half
pitch. After filling, frames are drawn only while the trail is active.

## Progress value

Eases toward the target (see `preloader.spec.md`); reported to the host on each
integer change.

## Reduced motion

No edge sweep and no trail: the grid is static, and at 100 the lit layer fades
in over 400ms. The counter and bar still advance.
