# Reads hotspots (desktop, ≥1025)

Reference: the `.hotspot*` rules in `app.scss`, `lib/scene/ui/Annotations.ts`,
`lib/utils/animations/annotationReveal.ts`, and the eyes + "Hover to explore" of
`lib/components/CircleBackground.svelte` (whose circles another builder draws).

Files: `src/components/reads/ReadsHotspots.tsx` + `.module.css`, `useEyeFollow.ts`.

## Anatomy

```
.layer                      absolute inset 0 of the stage section; pointer-events none
  .hotspot (.opensRight | .opensLeft)   left --hotspot-left | --hotspot-right, top 50%
    .buttonReveal           scroll-scrubbed wrapper
      button.button         aria-expanded, aria-controls, aria-label = group title,
                            data-cursor-hide (the custom cursor hides over it)
        .eye                white disc + own-drawn eye glyph (pupil follows the pointer)
        .cross              own-drawn X (two strokes + a diamond)
    .hintReveal > .hint     "Hover to explore" (aria-hidden), below the button
    .desc                   glass panel
      .summary  (aria-hidden)   title + summary
      .content > .mask > .inner (id, region)  title + summary + items list
```

Hotspot 0 opens towards the centre (panel to its right), hotspot 1 likewise (to its left).

The hotspots ride the circle background's side circles: `Reads` reads
`sideCircleCentres(circleFrameAt(step, value).width)` from
`chrome/circles/timeline.ts` (step = reads, or the next section past progress 1) and
passes the centres and diameter in; at rest that is 14% / 86% and 24vw, and from reads
0.906 they sweep outward with the circles. The hairline through each hotspot is the
circle background's side line, so it is not drawn here.

## Geometry

| | ≥1440 | 1025–1439 | ≥2245 |
|---|---|---|---|
| button | 3.3rem, blur 20px, bg rgb(255 255 255/.05) | 42px, blur 10px, bg /.12 | 6rem |
| hint | `top: calc(50% + diameter · .12)` (2.88vw at rest), 1rem mono `--grey-300`, centred, min-width 143px | same | 1.875rem |
| desc | beside: `left: 4.3rem` / `right: 4.3rem`, `top: 50%`, `translateY(-1.35rem)` | below: `left: 50%`, `top: calc(100% + .75rem)`, `translateX(-50%)` | beside |
| expanded width | 27rem | `min(78vw, 19rem)` | 36rem |

Button: 1px rim rgb(255 255 255/.25), inset .2rem ring rgb(255 255 255/.9). Eye disc fills
the button (collapsed look = the screenshot's white eye). Hint sits where the reference's
circle title does (62% down a circle 24vw across).

Panel surface: `var(--grey-600)` + the 145° highlight, blur(20px) saturate(135%),
radius .75rem (.95rem below 1440), shadow `0 16px 34px rgb(3 8 18/.5)` with inset
top/bottom hairlines. Text left-aligned in both variants (a bulleted list reads badly
centred or right-aligned). Title mono 1rem (.9rem <1440); summary sans .85rem
(.78rem <1440) white/.8; items sans .8rem white/.72 with 3px dots.

## Open / close (real time, from the reference)

| | open | close |
|---|---|---|
| eye disc | scale 0 (.25s) | back |
| X | `rotate(45deg) scale(1)`, opacity 1 (.3s sine in-out) | reverse |
| ring | scale 1.08; button bg /.12, glow `0 0 20px rgb(255 255 255/.18)` | reverse |
| hint | fades, scale .7 (.3s ease-out) | back |
| desc size | summary box → content box, .5s `EASE.backOut` | .5s `EASE.backIn` |
| desc opacity | .2s | .3s after .3s |
| summary | opacity 0 in 50ms | back in 400ms after 300ms |
| content | opacity 1 in 300ms | out in 300ms |

Sizes are measured with a ResizeObserver (summary box, inner box) into
`--desc-{w,h}-{collapsed,expanded}`; no re-render.

Viewport clamp (opened only, reference `axisClamp`, margin 28px): computed from the
hotspot box and the measured content size, written to `--magnet-x/--magnet-y`.

## Interaction

One hotspot open at a time; state `{ index, pinned } | null` in the layer.

| input | effect |
|---|---|
| mouse enters hotspot | open (unless suppressed) |
| mouse leaves | close after 140ms unless pinned; clears suppression |
| focus enters | open |
| focus leaves | close unless the pointer is over it |
| click / tap / Enter / Space | open+pinned; if already pinned, close and suppress hover |
| Escape (anywhere) | close, suppress until leave/blur |
| pointerdown outside | close |
| hotspot scrolled away (progress < .5) | close (state adjusted during render) |

Sounds: `hover` when a pointer opens one, `click` on click.

## Reveal (scroll-scrubbed; card beat p per hotspot)

The reference's 820ms reveal timeline mapped onto p:

| part | span of p | motion |
|---|---|---|
| button | 0 → .49 | `translateY((1-q)·20%) scale(q)`, opacity q |
| hint | .51 → 1 | rises 18px, opacity |

Pointer events on once p > .5. Eye glyph follows the pointer (fine pointers only): offset
normalised by the eye radius, dead zone .12, cubic ease-out, ±5px, smoothing .24/frame.

## Reduced motion

Reveal transforms off (opacity kept), open/close transitions 1ms, eye does not follow.
