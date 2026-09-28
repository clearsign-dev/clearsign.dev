# Preloader: circles and the gate

Reference: `lib/components/Preloader/SvgArt/**`, `PreloaderCta.svelte`,
`usePreloaderVisualizer.ts`. Screenshot: `reference-preloader-cta.jpg`.

Files: `src/components/chrome/Preloader/Art.tsx` + `Art.module.css`,
`Gate.tsx` + `Gate.module.css`, `DotGlyph.tsx`.

## Circles (decorative, `aria-hidden`)

- Centred square frame, z 1, no pointer events:
  `min(691px, 78vmin, 100vw − 2rem, 100vh − 2rem)`;
  ≤1400 `min(620px, 72vmin, 100vw − 2.5rem, 100vh − 4rem)`;
  ≤1024 `min(540px, 66vmin, 100vw − 2.5rem, 100vh − 6rem)`;
  ≤640 `min(400px, 82vmin, 100vw − 1.2rem, 100vh − 6.2rem)`. Hidden ≤767.
- Geometry in a 1000-unit box (angles clockwise from 12 o'clock):

| Arc | Radius | From → to | Stroke | Crosshair at |
|---|---|---|---|---|
| outer right | 500 | 58° → 122° | 1.45 | 90° |
| outer left | 500 | 238° → 302° | 1.45 | 270° |
| inner right | 250 | 20° → 160° | .73 | 0° |
| inner left | 250 | 200° → 340° | .73 | 180° |

- Stroke: ink, transparent at both ends and full at the middle of the arc;
  group opacity .5, `mix-blend-mode: difference`.
- Crosshair: 13-unit "+" (1.04-unit bars) with a small diamond at the centre, ink.
- Settled transforms: outer arcs `translateX(±5%) scale(1.8)`; inner `scale(2)`.
  ≤1215: 2.5%, 1.5, 1.75. ≤860: 1.4%, 1.32, 1.45. ≤555: .8%, 1.1, 1.1.

| Intro | From → to | Duration | Delay | Ease |
|---|---|---|---|---|
| frame | opacity 0, scale .92 → 1 | .95s | .05s | ease-out |
| outer arcs | scale 0 → settled | 2.8s | .25s | customReveal |
| outer crosshairs | orbit 180° → 0° about the centre | 2.8s | .25s | customReveal |
| inner arcs | opacity 0 → 1 | 1.2s | .2s | customReveal |
| inner arcs | scale 0 → settled | 2.8s | .25s | customReveal |
| inner crosshairs | orbit −180° → 0° | 2.8s | .25s | customReveal |

Exit: arcs back to scale 0 (inner also fade), crosshairs orbit back, .8s; the
frame collapses to scale 0 and fades, .62s after .48s.

## Gate

- Centred column (translate −50%), width `min(92vw, 360px)`, padding 0 12px,
  gap 8px, `--grey-300`, line-height 150%. Starts at opacity 0, scale .72,
  `inert` until ready.
- Ready: wrapper → opacity 1, scale 1 over .86s customReveal after .1s. Orb
  scale .74 → 1 (.6s, bounce `cubic-bezier(.34, 1.56, .64, 1)`, .1s). Title,
  subtitle, START: opacity 0, scale .82 → 1, .75s bounce at .2s / .3s / .4s.
- **Orb** (decorative): 56px circle (52 ≤1400, 46 ≤1024, 40 ≤640). Background:
  radial accent glow at 50% 80% over a dark → deep-accent vertical gradient;
  1px ring of accent at 42%; outer glow deep accent 22% (28px) and 18% (66px);
  inner shadow `0 11px 20px` black 44%. While START is hovered or focused the
  orb scales 1.08, a second ring shows at −7px and the glow strengthens.
- **Glyph**: our own dotted waveform in a 44 × 24 box, 9 columns of dots (r 1.35,
  pitch 5.2), 5 rows. At rest a centred pulse (column heights 0 0 1 1 2 1 1 0 0).
  While START is hovered or focused it moves as a live wave with a soft glow.
  Static under reduced motion.
- **Title** `PRELOADER.gate.title`: mono 400, 1.33rem, uppercase, tracking .08em,
  ink, line-height 110%, margin .92rem 0 .54rem. **Subtitle**
  `PRELOADER.gate.subtitle`: .875rem, tracking .03em, `--grey-300`, margin-bottom
  .72rem. Both stay on one line above 555px and wrap below it.
- **START** `PRELOADER.gate.button`: a real `<button>`. Pill, padding .42rem
  .72rem, 1px border accent 52%, background accent 26% → deep accent near black
  74%, text pale accent, tracking .12em, .58rem uppercase, shadow
  `0 8px 24px` accent 14%. Hover: lift 1px, scale 1.04, brighter border and
  text, accent glow. Focus-visible: ink border and a two-ring shadow.
  Tablet (767–1024, or coarse pointer ≥767): 120 × 48 glass pill, .5px border,
  14px, 50px backdrop blur, tinted with the accent.
- Exit: wrapper → opacity 0, scale .96 (.6s); orb → scale .2, opacity 0 (.54s);
  labels → scale .8, opacity 0 (.5s); START → scale .88, opacity 0 (.45s).
- Reduced motion: everything fades, no scaling, no glyph motion.
