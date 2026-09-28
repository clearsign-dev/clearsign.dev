# Scene: the particle mark

Reference: `lib/scene/MainScene.ts`, `OctagonScene.ts`, `particles/*` (the octagon as
point lattices, fluid-field disturbance), `postprocessing/{RGBSplit,CA,Vignette,Transition}Node`,
`fog/DaoFog.ts`, `grid/GridPlane.ts`, `interaction/MouseParallaxShift.ts`,
`transitions/IntroTransition.ts`, `runtime/FramePacingGovernor.ts`, `GraphicsConfig.ts`,
`theatre/features/desktop.json`. Screenshots: `reference-intro-octagon.jpg`,
`reference-awwwards-hero.jpg`. Technique and values only: all geometry, shaders and
noise here are generated in code.

Files (`src/components/scene/`): `Scene.tsx` (container, lifecycle, preloader contract),
`engine.ts` (renderer, loop, uniforms), `geometry.ts` (every formation's point layout),
`choreography.ts` (per-section states, windows), `shaders.ts`, `pointerField.ts`,
`quality.ts` (tiers, probe, governor), `tokens.ts` (CSS tokens to shader colours).

## Technique

- `THREE.WebGLRenderer` (WebGL2), antialias off, no depth or stencil buffer.
- **One `THREE.Points` draw call** holds every point. Each point carries a target in each
  of five formations (attributes); the vertex shader places it by blending the two active
  formations with a per-point stagger. Nothing is simulated on the CPU per point.
- Points are round sprites in `--ink`, top-lit like tiny balls (the reference shades each
  sprite as a sphere), size attenuated by depth with a 1.5 buffer-pixel floor whose lost
  area is paid back in alpha (the reference's `MIN_SPRITE_PIXELS`). Additive blending,
  so no sorting. Slow per-point shimmer plus a travelling brightness wave.
- Depth fog: `exp(-((d - near) * density)^2)` from just behind the subject plane, so
  whatever recedes (the S in problem, the field, contact) sinks into the black.
- **One post pass** (fullscreen triangle over a render target): radial RGB split, the
  proof fog fill, faint accent haze, the dotted grid, the getIt glow, vignette, the intro
  dot and a 1/255 dither. Three texture taps for the split, fbm only while the fill is up.

## The mark in points (units: the C's centreline radius = 1)

From `brand/make-mark.py` (1024 grid / 292):
- **C**: three concentric rows of rods filling the 132 stroke (rod 0.127 square section,
  row gap 0.035) at r = 0.838 / 1 / 1.162, split into 7 / 8 / 9 curved rods with 0.045
  gaps, from 54° counter-clockwise to 306° (the opening on the right, half-angle 54°).
  Every rod end is cut radially, so both terminals are flat. Each rod is a regular shell
  lattice (long edges chamfered, end faces filled), like the reference's rods.
- **S**: a tube of rings along two circles r = 0.404 centred 0.089 right of centre, top
  bowl 34° → 270° counter-clockwise, bottom bowl 90° → 214° clockwise; tube radius 0.178
  (104 stroke), depth flattened to 0.72, hemispherical lattice caps (the round ends).
- The brand's knockout: C points within 0.178 + 0.051 of the S centreline are dropped.
- Lattice spacing is solved from the tier's point budget, never jittered.

## Formations

| id | formation | layout |
|---|---|---|
| M | mark | above, transformed by `uMark` (position from NDC, scale, tilt, breathing) and `uSplit` for S points |
| R | reads | two lattices of 5 × 6 byte-blocks (filled 3D dot blocks, some dim), centred at 14% / 86% of the width on the vertical centre, 18vw wide; a scan line walks down the rows |
| B | band | a lattice strip of 5 rows × 10 depth layers × N/50 columns, full width, low on screen, gentle wave |
| F | field | random points across the frustum, z from +2 to −22, receding at 0.35 u/s with wrap; 14k shown (5k ≤ 1024px) whatever the tier; a soft rectangle clears the text zone |
| S | ships | four clusters down the right side, each deeper: a cube, a slab, three text-line rods, a ring; each turns slowly |

Screen-anchored formations (R, B, F, S) are stored in NDC and unprojected in the shader
from `uFrustum = (tan(fov/2)·aspect, tan(fov/2), camZ)`, so they hold their screen
positions at any aspect. Unused slots in a formation fly with a neighbour at alpha 0.
Slots are matched to points by rank of the point's x in the mark, so every morph flows
left-to-left instead of crossing.

## Choreography

`P = step + value` (0..8), damped toward the store every frame (140 ms), so jumps sweep
through instead of snapping. States blend over windows in P, smootherstep eased.

| section | formation | camera and subject (desktop) | notes |
|---|---|---|---|
| hero | M | fit 1.78 (mark ≈ 69% of height), centre, breathing ±0.16 rad | full disturbance |
| problem | M | pull back to fit 2.7, mark to NDC x −0.42; the S slides +0.72 right, 1.9 back, turns 0.55 rad | right half calm: no disturbance or shimmer past 45% width |
| reads | R | fit 2.4 | M → R over P 1.82–2.32; centre stays dark |
| proof | B | fill sweeps in over value 0–0.35, holds at 0.82–1 opacity | R → B over 2.95–3.38, under the fill |
| evidence | F | calm, disturbance 0.3 | fill clears over P 3.82–4.12; B → F under it |
| ships | S | clusters at x 0.6–0.8 | F → S over 4.88–5.3 |
| getIt | M | scale 0.72 at NDC (−0.45, 0.3), inner glow 1 | S → M over 5.86–6.34; S part and the core brighten toward accent |
| contact | M | pushed to z −7, brightness 0.45 | far and faint |

Look windows (look = camera fit, mark transform, split, brightness, glow, disturbance,
CA, vignette, grid, parallax): 0.72–1.55, 1.8–2.3, 2.86–3.3, 3.84–4.14, 4.86–5.3,
5.84–6.32, 6.78–7.35.

**Mobile (≤ 1024px)**: its own table. FOV 55° on portrait; `fit` is the half of the
shorter side, so the mark spans ~80% of a phone's width in the hero. The subject moves
up behind the text (problem y 0.45, getIt y 0.1), reads lattices sit in the upper half
at ±0.5 (the hotspots are hidden there and cards take the bottom), the clear zone covers
the full-width slider, ship clusters are smaller.

**Intro** (on `introStarted`, 3.0 s, dt capped at 1/30 s as the reference does): a bright
dot grows at the mark centre (0–0.35 s); C rods fly out from it, swirling 1.3 rad into
place, sweeping from the top terminal round to the bottom one (0.35–1.55 s) and growing
along their arcs (+0.32 s); the S draws along its path (0.85–2.0 s); each point's
flight is 0.9 s ease-out cubic; the dot fades 2.1–2.8 s. Other formations fade in with
the intro. Before `introStarted` only the grid renders (on demand, not every frame).

**Pointer**: camera parallax ±0.35 × ±0.2 world at camZ 5, 8/s smoothing, off on touch.
A CPU velocity field (~2000 cells at the viewport aspect, RGBA8 texture): splats from
pointer velocity (uv/s, clamped ±4 × 0.7), semi-Lagrangian self-advection, 20%
neighbour diffusion, 0.42 s decay, a radial pulse on pointer-down. The vertex shader
samples it at each point's screen position: activity = smoothstep(0.03, 0.7, |v|) pushes
the point along the flow and out along its own random direction, brightens and grows it,
and settles back as the field decays. Idle field = no uploads.

## Post pass uniforms

| uniform | value |
|---|---|
| RGB split | radial from centre, R at +off, G at −0.35 off, B at −off; base 0.0022 uv at the edge × (1 + 0.5 sin 1.3t); + motion (scroll speed + pointer speed) up to 0.005; + local field velocity × 0.0025 |
| fill | ridged 3-octave value noise, diagonal sweep, threshold −0.35 → 1.35, softness 0.16, noise 0.28; colour ground → accent-deep × 0.55 with accent ridges and a bright front rim; clears the same way it came |
| haze | accent-deep × 0.1, centre-weighted, slow noise |
| grid | 14 CSS px pitch, 0.65 px dots, ink × 0.055, shifted opposite the parallax |
| vignette | half-min-dimension radius, smoothstep 0.35–0.95, 0.55–0.7 by section |
| dot | 7 CSS px ink disc with a soft halo |

Colours are read once from `--ink`, `--accent`, `--accent-deep`, `--ground` via
`getComputedStyle(document.documentElement)`.

## Performance

| tier | who | points | DPR cap | pixel cap | field |
|---|---|---|---|---|---|
| high | desktop, ≥ 8 cores, ≥ 8 GB | ~64k | 1.5 (2 if the probe is clear) | 2560×1440 (3840×2160 at 2) | 2200 cells |
| medium | other desktops | ~42k | 1.5 | 1920×1080 | 1800 |
| low | touch | ~15k | 1.5 | 1600×1000 | 1000 |

- Probe: after compile, six frames in the heaviest state (band + fill) synced with a
  1-pixel `readPixels`; median > 12 ms drops the render scale to 0.8, > 22 ms to 0.65 and
  the cheap fill. Clear high tier (< 4.5 ms, device DPR ≥ 2) unlocks DPR 2.
- Governor (the reference's): 120-frame window, every 2 s, p95 > 33 ms demotes one step
  (render scale 0.8, then 0.65 + cheap fill), 4 s cooldown, two steps at most.
- Loop pauses when `document.hidden`; renders on demand before the intro and under
  reduced motion. Budget: 2 draw calls, ~100 bytes of attributes per point (6.4 MB high).
- `prefers-reduced-motion`: intro skipped, states switch by section (no morphs, no
  sweep: the fill is a steady 0.85 during proof), no parallax, disturbance, shimmer,
  breathing, drift or CA pulse.
- No WebGL2: render nothing, set the preloader ready at once.

## Preloader contract

Progress 3 (mount), 30 (three imported), 55 (geometry), 65 (renderer), 85 (shaders
compiled with `compileAsync`), 92 (probe), then `ready: true` after the first real frame.
Any failure sets `ready` so the gate never hangs.
