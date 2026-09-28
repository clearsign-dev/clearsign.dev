# CircleBackground

`src/components/chrome/CircleBackground.tsx` + `CircleBackground.module.css`,
timeline maths in `src/components/chrome/circles/timeline.ts`.
`export function CircleBackground()`.

Reference: `lib/components/CircleBackground.svelte`, fed by `routes/+page.svelte`
with the scene clock; `lib/scene/animation/sceneManifest.ts` for that clock's
section slices. Screenshots: `reference-problem-about.jpg`,
`reference-reads-services.jpg`, `reference-preloader-cta.jpg`.

## Clock

The reference drives the overlay from its 3D scene clock, a per-section linear
map of scroll: section *i*'s progress runs across a fixed slice of the clock.
Slices (frame / 2801): hero 0–260, About 260–350, Services 350–750,
Collaboration 750–800, Blog 800–1300, Partners 1300–1450, Process 1450–2720,
Contact 2720–2801.

We rebuild that clock from `stageProgress.step` and `.value`, section for
section (problem ← About, reads ← Services, proof ← Collaboration, …), so each
of our sections plays exactly what its counterpart plays, with the same
continuity (and the same change of pace) at every boundary.

## Geometry

A square centred on the viewport, `width` % of the viewport width.

| Piece | Size | Notes |
|---|---|---|
| outer ring | 100% of the square | with the two crosshairs and two side lines, as one unit |
| middle ring | 80% | |
| inner ring | 60% | |
| side circles | 50% each | outside the square, left and right, tangent to the outer ring at the crosshairs |
| crosshairs | 1.1rem (3.5rem at 767–1024px) | a plus with a small diamond, centred on the outer ring's left and right points |
| side lines | 20vw × 1px | from each crosshair outwards, 30% ink → transparent |

Every ring is a 1px stroke (non-scaling) with a vertical fade: transparent at
the top and bottom, full at the horizontal centre line (the fade spans 20% →
80% of the ring's height). Peak alphas: outer 0.5, middle 0.48, inner 0.65,
side 0.4 (the reference doubles each stroke and scales it with the ring; these
match what that looks like at the two resting sizes).

Side circle centre: `50 ∓ 0.75 · width` vw across, 50vh down; diameter
`width / 2` vw. At the reads rest (`width = 48`): **14vw and 86vw, 50vh,
24vw across** — the brief's numbers, confirmed by the reference geometry and
by `reference-reads-services.jpg` (204/1456 and 1252/1456 px).

## Beats (reference clock → our sections)

| Beat | Clock | Ours | Curve |
|---|---|---|---|
| all three rings bloom: scale 0.2 → 1, fade in | 0.07 → 0.13 | hero 0.754 → reads 0.035 | ease-out cubic |
| square contracts 88% → 48% | 0.127 → 0.138 | reads 0.014 → 0.091 | cubic-bezier(0.5, 0, 0.45, 0.94) |
| inner ring out | 0.127 → 0.136 | reads 0.014 → 0.077 | ease-in-out cubic |
| middle ring out | 0.131 → 0.138 | reads 0.042 → 0.091 | ease-in-out cubic |
| side circles draw in (from the crosshair, both ways) | 0.127 → 0.138 | reads 0.014 → 0.091 | linear draw, ease-out expo opacity |
| hold: one ring + two side circles | 0.138 → 0.254 | reads 0.091 → 0.906 | — |
| side circles fade | 0.244 → 0.296 | reads 0.835 → evidence 0.058 | ease-in expo |
| square expands 48% → 130%, outer unit fades | 0.254 → 0.296 | reads 0.906 → evidence 0.058 | cubic-bezier(0.23, 1, 0.32, 1); ease-in-out cubic |

So: problem shows the three rings with crosshairs and hairlines (About);
reads shows the single ring and the two side circles (Services); in proof the
ring has already swept past the viewport edges and is fading (Collaboration);
it is gone just after evidence begins. Outside clock 0.07–0.296 the layer is
`visibility: hidden` and does no work.

Side lines: the source retracts them during the contraction, but the live
reference screenshot of Services shows them at full length from the
crosshairs. We follow the screenshot; `SIDE_LINES_RETRACT` flips it.

## Hotspots (another builder)

The reads hotspots sit at the side-circle centres. During the reads hold those
are fixed (14vw / 86vw, 50vh). From reads 0.906 they sweep outwards with the
expansion; `circleFrameAt(step, value)` and `sideCircleCentres(width)` from
`circles/timeline.ts` give the live positions and the side-circle opacity if
the hotspots want to ride along, as the reference's do.

## Layer

`position: fixed; inset: 0; z-index: 3` (above the scene canvas at 1, below
the sections at 12), `pointer-events: none`, `aria-hidden`, `contain: strict`.
Not rendered on phones (≤ 767px, CSS and JS) or on handheld devices (mobile
user agent, or a coarse pointer with a short edge ≤ 1024px), as in the
reference. Updates are written straight to the DOM from a store subscription,
not through React renders.

## Reduced motion

Rings fade in place (no bloom), side circles appear whole (no draw), and the
exit is a fade at the reads size instead of the sweep, over reads 0.906 → 1
(where the sweep would have carried everything out of view). The contraction
is kept: it is short and moves only under the visitor's own scroll.
