# Tag

Reference: `lib/components/Tag.svelte` (not placed on any page in the reference;
ported for completeness).

## Overview

A small grey label chip that leans toward the pointer with the same resonance as
the buttons, at a lower intensity.

## DOM

```
div.tag   (data-cta-active)   text
  ::before  pointer glow
```

## Values

- Type: interface mono, `text-sm` (0.875rem / 1.25rem line); ≥2245px `text-xl` (1.25rem / 1.75rem).
  Word spacing `var(--word-spacing-mono)`.
- `color: #fff; padding: .35rem 1rem; width: fit-content; background: var(--grey-600);
  border-radius: 4px; margin-bottom: 1rem; overflow: hidden; position: relative`.
- Shadow: `inset 0 1px 0 rgba(255,255,255,.06), 0 0 0 1px rgba(255,255,255,.03), 0 12px 24px rgba(7,10,18,.12)`.
- Transform: `perspective(760px) translate3d(shiftX×.48, shiftY×.48, 0) rotateX(tiltX) rotateY(tiltY) scale(s)`.
- Transitions: transform and box-shadow 420ms, background 320ms, all `cubic-bezier(.16,1,.3,1)`.
- Glow `::before`: inset −24%; radial 12rem at pointer, white glow×1.2 → ×.22 (22%) → 0 (62%);
  screen blend; opacity glow×2.3; counter-shift −.2× shift; opacity 360ms, transform 420ms.

## Behaviour

Resonance with `maxShift 3.5, maxRotate 1.4, maxGlow .12` on fine pointers. No
click behaviour of its own.

## Props

`text`, `className?`, `as?` (`div` by default).
