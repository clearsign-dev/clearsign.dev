# Button

Reference: `lib/components/Button.svelte`, `lib/utils/actions/{ctaResonance,directionalFill}.ts`,
`lib/utils/hoverSound.ts`. Screenshots: `reference-contact.jpg` (accent submit),
`reference-proof-collaboration.jpg` (dark "Connect now"), `reference-hero.jpg` (vertical tab).

## Overview

A clipped-corner call to action. Two colours (dark panel, accent), an optional
upright tab form, an optional plus-with-diamond icon. On hover a fill circle
grows out of the point where the pointer entered, a short glitch runs, and on
fine pointers the whole button leans toward the pointer and picks up a glow.

## DOM

```
a | button.button[.accent][.vertical][.revealed]   data-cursor-label, data-cta-active, data-cta-pressed, data-glitch
  span.bg                 gradient layers over --button-bg          z 0
  span.circleWrap         overflow hidden, aria-hidden               z 2
    span.circle           fill circle, --button-accent
  span.glitch             glitch slices, aria-hidden                 z 2 (after circle)
  span.content            label + icon                               z 3
    span.label
    svg (showIcon)        plus with a diamond at its centre
```

`::after` on the root is the pointer glow (screen blend).

## Values

- Root: `padding: 1rem 0; width: 100%; clip-path: var(--clip-corner)`; flex centre;
  `isolation: isolate; overflow: hidden; transform-style: preserve-3d`.
- Transform: `translate3d(shiftX, enterY + shiftY, 0) rotateX(tiltX) rotateY(tiltY) scale(s)`.
- Transitions: color 320ms `--motion-ease-standard`; transform, box-shadow, filter 420ms `cubic-bezier(.16,1,.3,1)`.
- Resting shadow: `0 1px 0 rgba(255,255,255,.06) inset, 0 0 0 1px rgba(255,255,255,.04), 0 18px 34px rgba(6,8,12,.2)`.
- Active (hover/focus): `… .08 inset, … .06, 0 24px 46px rgba(8,10,16,.32), 0 12px 30px accent/.16`; `saturate(1.08)`.
- Pressed: `… .05 inset, … .05, 0 12px 24px rgba(8,10,16,.22)`; scale .982.
- Glow `::after`: inset -18%; radial 18rem circle at pointer, white at glow×1.45 → ×.42 (18%) → 0 (52%),
  plus a 120° sheen; opacity `.08 + glow×1.8`; counter-shifted by −.24× shift.
- bg: `linear-gradient(180deg, rgba(255,255,255,.09), transparent 38%), linear-gradient(135deg, rgba(255,255,255,.04), transparent 56%), var(--button-bg)`.
- Circle: size `--button-circle-size` (default 160px), centred on `--button-circle-x/y`,
  `scale(0)` → `scale(1)`; transform/width/height .9s `cubic-bezier(.16,1,.3,1)`.
- Content: gap .7rem, padding 0 1.25rem; `translate3d(shift×.08, shift×.08, 18px)`, on hover ×.12 and 22px.
- Icon: 1rem square; hover `translate3d(.18rem,0,0) rotate(90deg)`, 420ms.

Colours (brand remap):

| | dark (default) | accent (reference `color="red"`) |
|---|---|---|
| `--button-bg` | `var(--dark)` | `var(--accent)` |
| fill circle | `var(--accent)` | `#fff` |
| text | `#fff` | `var(--on-accent)` |
| text on hover | `var(--dark)` | `var(--dark)` |
| glitch slices | `var(--accent)` | `#fff` |

## Behaviour

- **Directional fill**: on mouseenter and mouseleave the circle is centred on the
  pointer's local position; its diameter is twice the distance to the farthest
  corner plus 24px, so it always covers the button. It grows on hover and shrinks
  back toward the exit point on leave. Keyboard focus centres it.
- **Glitch** on mouseenter: the reference toggles a `glitch--run` class but ships
  no CSS for it, so the effect here is our own: ~360ms of stepped slices in the
  glitch colour plus a 1–2px label jitter; horizontal slices, vertical on the tab.
  Restarts on every enter; skipped under reduced motion.
- **CTA resonance** (fine pointers, motion allowed): normalised pointer position
  n ∈ [−1,1]²; shift = n × 10px, tilt = (−ny, nx) × 3.5°, glow = |n|/√2 × .18,
  pointer = (n+1)/2 × 100%. Each value eases toward its target by 0.16 per frame
  and stops when settled. Leave resets; focus holds glow at .55 × max.
  Enter/focus dispatch `cursor:hover-anim` on window with the button centre.
- **Pressed**: pointerdown and Enter/Space keydown → pressed, scale .982; up/cancel/keyup release.
- **Focus**: `:focus-visible` floods the fill from the centre and shows a 1px
  currentColor ring 5px inside the edge (a `::before` above the layers, since the
  clip-path cuts outside outlines and the element's own outline paints under its
  positioned layers).
- **Hover sound**: `playSfx("hover")` on mouseenter unless disabled.
- **Disabled**: `<button disabled>` or `<a aria-disabled tabindex=-1>` without href;
  `cursor: not-allowed; opacity: .7`; no fill, glitch, sound or resonance.
- **External links** (`http(s):`) open in a new tab with `rel="noopener noreferrer"`.

## Vertical tab

`writing-mode: vertical-rl`; padding 1.4rem 1.25rem 1.9rem; gap 1rem; width 3.5rem.
Font .9rem and a 1em icon, as the header's own tab sets them (that is what the
screenshots show; Button.svelte's unused vertical style says 1.1rem / 1.4rem);
≤390px 1rem and width 3.1rem. The label is flipped with `scale(-1,-1)` so it
reads bottom-to-top, with the icon at the bottom; on hover the icon only turns 90°. Hidden state: opacity 0,
enter-y −110%; `revealed` slides it down to 0 and fades it in, 760ms
`cubic-bezier(.16,1,.3,1)` after .14s. While hidden it is not focusable and
ignores the pointer.

## Reduced motion

All transitions and animations collapse to ~0; resonance snaps instead of easing;
no glitch.
