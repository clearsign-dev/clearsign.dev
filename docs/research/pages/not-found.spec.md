# 404 (`src/app/not-found.tsx`)

Reference: `routes/+error.svelte`, `routes/404.ts` (a WebGPU scene: GLB model,
volumetric fog, reflector floor, bloom), `lib/components/NotFoundPreloader.svelte`,
`lib/voidhero/konami.svelte.ts`, `lib/components/VoidHero/{HeroHeading,KonamiHint,IdleHint}.svelte`,
`lib/components/ScrollIndicator.svelte`. Screenshot: `reference-404.jpg`.
Copy: `NOT_FOUND` in `src/lib/content.ts`.

## What the reference shows (1512 × 861)

- Black, smoky volume. One light source: a white doorway at the exact centre of
  the viewport, blooming into fog, spilling a bright streak down a wet floor.
  Faint diagonal slabs of lit wall top-right and bottom-right; slow motes.
- `4 ▯ 4`: HeroHeading, fixed at 50%/50%, 25rem, line-height 90%, dark glass
  fill (three stacked gradients + a radial highlight that drifts toward the
  pointer: range 34px, smoothing 0.11), `-webkit-text-stroke: .4px rgba(255,255,255,.2)`.
  Entrance: opacity 0→1 (.85s ease .15s), scale .86→1 (.95s cubic-bezier(.2,.8,.2,1) .15s).
  ≤1024: 12rem; ≤465: 8rem; ≤395: 6.5rem. Gap between the 4s ≈ .69em.
- The dot: a 53px circle `rgb(0 0 0/.5)` with a 20% white centre, fixed at the
  viewport centre. It is the go-home button. Hover: scale 1.1, centre scale .5,
  and the scene narrows its FOV (zooms toward the door).
- `GO HOME` at `top: 70%`, centred column, gap .25rem: label 1.5rem display type,
  line-height 120%, word-spacing 25%; beneath it "It's much more safe there"
  .875rem mono. Black on the lit floor. Phone: white, `backdrop-filter: blur(12px)`, padding .45rem.
- Logo top-left, padding 1.2rem, width 7rem (phone 6.2rem, padding 1rem .625rem).
- Tick ruler top-centre (ScrollIndicator): 23.5rem × 2rem, radius .25rem, dark
  gradient, 8 big ticks (2px × .9rem) with 3 small (2px × .6rem) between, gap
  .6rem, first tick red with two markers above and below. Hidden ≤767.
- Tracker bottom-left: `Error ◆ Void`, bg grey-600, 1px border grey-300/.3,
  padding .4rem 1rem, .56rem mono, colour #c6c9d6, radius .25rem, blur 50px, gap 1rem;
  diamond .46rem grey-300. ≤1024: moves top-right.
- Tagline bottom-right: bottom 1.2rem, right 1.25rem, 1rem mono 300, #a9aebb,
  right-aligned, line-height 120%, three lines. Hidden ≤1024.
- UI fades in over .8s once the scene is ready.

## Behaviour (reference)

- **Idle hint** (IdleHint): after 5s with no pointermove/pointerdown/keydown/wheel/
  touchstart, shows once per visit, only while the Konami index is 0. Pill fixed
  bottom 1rem centre: `Hey! Still here? Click [↑][↑]`. Clicking a key-cap hides the
  pill and feeds `ArrowUp` to the tracker. Phone: a transparent uppercase line
  whose action skips the code and starts the game.
- **Konami** (konami.svelte.ts): ↑ ↑ ↓ ↓ ← → ← → B A. A correct key advances; a
  wrong one resets to 0, or to 1 if it was ↑. 2.4s without progress resets to 0.
- **Konami hint** (KonamiHint): once the index is ≥1, a row of the ten keys shows at
  `bottom: 1.2rem + 3.4rem`, lit up to the index; each glyph is a button that
  feeds its key. Hidden on phone.
- On completion the game opens. While it runs, the CTA and tagline fade out.
- **Go home**: the camera rushes into the door, exposure climbs to white; UI fades
  (1.2s ease-in, .4s delay); the site preloader shows at 1.2s; navigate at 1.8s.
- The 4s' highlight follows the pointer.

## ClearSign version

Procedural, no images, models or frame sequences. `NotFoundPreloader` is not
rebuilt: it exists to cover a GLB and texture download we do not have, and its
own copy is the reference's. The entrance runs as CSS animations, so it plays
before hydration.

Scene layers (`components/void/VoidScene.tsx`), back to front:
1. Ground `var(--ground)`.
2. Smoke: two value-noise canvases (small, drawn once, upscaled by CSS so the
   bilinear filter softens them), drifting slowly in opposite directions under a
   radial mask centred on the aperture, so the smoke reads as lit from there.
3. Light rays: an irregular conic fan from the aperture, strongest through the
   C's opening (the right, ±54°), masked to fade out, breathing slowly.
4. Two faint diagonal slabs of lit wall, as in the reference.
5. Floor below a horizon just under the ring: a lit pool, the spill streak and a
   squashed reflection of the glow, cut into ripples by a repeating mask.
6. Motes: one canvas, dust lit by distance to the aperture, slow drift, pointer parallax.

Heading: `4`, a slot, `4`. Dark glass fill as the reference with an extra
accent rim light on each 4's inner side (the side facing the light). Sizes as
the reference (Plex Mono's cap height at 25rem matches KH Interference's 280px).

Aperture (`components/void/Aperture.tsx`), the middle `0`: the Mark's C
(`MARK_PATHS.aperture`) at .5em, stroked in the 4s' dark material, its inner
edge lit; the disc inside glows ink-white fading to `--accent`; bloom behind it
(`--accent-rgb`); light escaping through the C's opening. The go-home dot sits
at its centre, which is the viewport centre.

| Reference | Ours |
|---|---|
| white door, grey-blue fog | ink core, `--accent` halo, neutral smoke |
| `GO HOME` black on the lit floor | `var(--ink)` on a dimmer floor (the scene is darker) |
| hover colour `rgb(151 222 255)` on key-caps | `rgb(var(--accent-rgb) / a)` |
| red active tick | `var(--accent)` |
| star markers on the ruler | two small triangles |

Copy: CTA `NOT_FOUND.back` / `NOT_FOUND.backNote`; tagline
`{code} — {title}.` then `body`, one sentence per line; tracker `tracker[0] ◆ tracker[1]`;
idle pill `NOT_FOUND.hint` + ↑ ↑ key-caps. The Konami row has no whisper line
(its copy is the reference's). Key-cap buttons are labelled with key names.
Phone idle pill: tapping a key-cap opens the game directly (the reference's
mobile shortcut), since a phone has no arrow keys.

Go home (dot, CTA text, wordmark): scene scales toward the aperture (ease-in),
light floods from the centre, then fades to ground; UI fades 1.2s after .4s;
`router.push("/")` at 1.8s. Modified clicks are left to the browser. Reduced
motion: navigate at once. Hovering the dot or CTA: scene scale 1.03, bloom up.

Game: `<VoidHero open={gameOpen} onClose={…} />`, always mounted. While open,
hints and the Konami listener are off and the CTA/tagline fade.

Reduced motion: no smoke drift, ray breathing or mote animation (one static
frame), entrance is opacity only, hint entrances are plain.

Native cursor. Page root `position: fixed; inset: 0; overflow: hidden`.

## Files

- `src/app/not-found.tsx` (server; renders `VoidPage`; `metadata.title`)
- `src/components/void/`: `VoidPage`, `VoidScene`, `Motes`, `Smoke`, `Aperture`,
  `TickRuler`, `Hints`, `useKonami`, `useIdleHint`, `usePointerDrift`, CSS modules.
