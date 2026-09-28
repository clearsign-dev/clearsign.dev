# Evidence train (reference: `scene/ui/TrainSlider.ts`, `TrainSliderHost.ts`, `trainSlider/*`)

Files: `src/components/evidence/EvidenceTrain.tsx` (+ `.module.css`),
`trainLayout.ts` (geometry), `trainDrag.ts` (drag controller).

The reference renders the slides as WebGL planes in a perspective camera. Here
they are DOM cards under a CSS `perspective`, with the same numbers.

## Camera and scale

Values read from the Theatre save-state (`theatre/features/*.json`, object
`TrainSlider`) and the scene camera (`DAO_full_scene.glb`, `Full_Camera_01`,
static at (0, 0.773, -6.609) looking down -z through the Blog scene).

| | desktop (>1024) | mobile/tablet (<=1024) |
|---|---|---|
| vertical fov | 22.89deg | 30deg (>768) / 33deg (<=768) |
| train group z | -16.45 → distance 9.84 | -20 → distance ~16 (camera ~-4) |
| group y vs camera axis | +0.077 | +0.73 |
| plane (local) | 8 x 4, gap 0.07 | 10 x 5 x viewportScale, gap -0.2 |
| group scale | (0.8 + 0.1 t) x 0.5, t = (vw-375)/1065 | 6.756 x clamp(vw/vh, 0.4, 0.78) / planeW |

- `pxPerWorld = vh / (2 D tan(fov/2))`; CSS `perspective = D x pxPerWorld`,
  origin at the viewport centre (the camera axis).
- `unit` (px per local unit) = group scale x pxPerWorld. Every local value
  below is multiplied by `unit`.
- viewportScale: <420 → 0.34, <560 → 0.42, else 0.62.
- Result at 1512x861: card 778 x 389, step 848px (about 1.8 cards across).
- Card height: desktop = width/2 (the reference's 2:1 artwork). Text cards
  need more room below 1024: tablet width/1.6, phone width x 1.15 capped to the
  free band between the description (+ badge) and the heading, and the train
  is centred in that band (clamped around the reference's 47% of vh).

## Per-slide layout (`trainSlider/layout.ts`)

For slide `i` and damped visual index `v`: `d = i - v`
- `focus = smoothstep(max(0, 1 - |d| / 1.24))`
- `x = sign(d) |d|^0.94 x (planeW + gap) x 1.08` (+ exit offset)
- `y = -0.3 - 0.2 focus` (three's y is up; CSS inverts)
- `z = 0.42 focus`, `scale = lerp(0.9, 1.025, focus)`, draw order `1000 + 100 focus`
- Per-card `--focus` follows `focus` with ~110ms smoothing (the uniform's 0.14
  per-frame lerp).

## Velocity curve (`materials.ts` `createContinuousPosition`)

- `progress = v / (n-1)`; velocity = d progress/dt x 3.6, clamped +-1.3, then
  smoothed with attack 11/s, release 5.5/s (two stages, as the reference).
- The shader bends each vertex: `z += sin(pi w) c 4 x 0.22`,
  `y += sin((w + pi/2) 0.8pi) c 0.9 x 0.12`, with `w = xWorld x 10 / (unitW x 5.5)`
  and `c = velocity x 10 x mobileCurveScale x 0.22`.
- DOM approximation: sample left edge, centre and right edge of each card;
  translateZ/Y by the weighted mean, rotateY by the edge chord slope. Gain 0.7
  and a +-24deg clamp keep the text legible while moving (only deviation).
- mobileCurveScale: <420 → 0.4, <560 → 0.46, <768 → 0.52, <=1024 → 0.58.

## Scroll → train

- Target index = `linearBeat(p, timing.slides) x (n-1)`: slide 1 in focus at
  the beat's start, slide 8 at its end.
- Visual index follows with `damp(…, 400ms)` (reference `snapSettlingSpeed`
  2.5/s); while dragging it equals the drag index (no smoothing).
- Entry over `[window.revealStart, slides.start]`: slides in from +8 world
  units on x and dollies from -4 on z with ease-out cubic; opacity rises over
  30-75% of the entry (Theatre `positionX` 8 → 0 while `opacity` 0 → 1, and the
  camera dolly toward the train).
- Exit over `[slides.end, window.hideEnd]`: `-20 x smootherstep` local units
  on x (the reference's exit distance), opacity out over the last 45%. The
  reference starts the exit at slider progress 0.7; it moves here after the
  last slide so the "not true yet" card is read centred.
- Entry/exit values glide with `damp(120ms)` so scroll jumps don't pop.

## Drag (`trainSlider/dragController.ts`)

- Press arms; drag starts after 12px travel, re-basing origin to avoid a jump.
- Pointer px per slide: `max(140, vw / 2.5)` desktop, `vw / 1.3` <=1024.
- Edge rubber band 0.18 slide: `edge ± r (1 - e^(-over/r))`.
- Drag scrubs page scroll (as the reference) via `goToProgress(…, immediate)`.
- Release: velocity from the last 80ms of samples; project `x + v x 0.55s`;
  snap: under 0.35 slide of intent stays, otherwise at least one slide in the
  fling direction; clamp to [0, n-1]; duration `clamp(dist / |v|, 0.35, 1.4)s`,
  easing expo-out (`SCROLL_TO_EASING`). Reduced motion: no projection, jump.
- Touch: `touch-action: pan-y` so vertical swipes stay native scroll and
  horizontal swipes drag (the reference drops touch drag entirely).
- Tap (<=350ms, <=14px) on an unfocused card moves to it (the reference opened
  the post; there is no post here).

## Keyboard and a11y

- The stage is `role="region" aria-roledescription="carousel"`, `tabIndex=0`,
  labelled by the heading text. ArrowLeft/ArrowRight one slide, Home/End first/
  last (propagation stopped so the stage's own Home/End don't fire). Up/Down
  stay with the page. Keyboard steps glide 0.55s (one slide flung at tau).
- Each card is `role="group" aria-roledescription="slide" aria-label="k of n"`.
- Focus ring: accent inset ring on the focused card when the region has
  `:focus-visible`. A polite live region (only while focused) reads the slide.

## Hover

- Fine pointer, desktop: tooltip with the hovered card's title follows the
  cursor (see `slide-tooltip.spec.md`); hidden while dragging.
- Pointer over the drag band or a card sets `cursor` store `{label: "Drag",
  active: true}`; leaving clears it if the label is still ours.
- Not rebuilt: the harmonica UV bands and fluid warp (image effects).
