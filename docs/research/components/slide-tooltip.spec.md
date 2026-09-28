# Slide tooltip (reference: `lib/components/SlideTooltip.svelte`, cursor label)

File: `src/components/evidence/SlideTooltip.tsx` (+ `.module.css`).

On desktop the reference shows the hovered slide's title next to the cursor
(the cursor's red label, fed by `cursor:set-text` from the raycast), and on
touch it shows `SlideTooltip`, a bubble with a tail. Here the bubble follows
the cursor on desktop with a fine pointer and shows the hovered card's title.

## API

Imperative handle (no re-render per pointer move):
`show(text, x, y)`, `move(x, y)`, `hide()`. Text changes re-render; position
is written straight to the element.

## Placement (reference `clampPosition`)

- Anchor at the pointer; bubble centred above it:
  `transform: translate(-50%, calc(-100% - 22px))`.
- Horizontal clamp: `[halfWidth + 12, vw - halfWidth - 12]`; if the viewport
  is narrower than the bubble, centre it. The tail shifts back toward the
  anchor by the clamped amount, limited to `halfWidth - 14`.
- Vertical: prefer above; flip below (`translate(-50%, 22px)`) when above would
  clip (12px margin) and below fits.

## Look

- `position: fixed`, `z-index` high, `pointer-events: none`,
  `max-width: min(24rem, 100vw - 24px)`.
- Background `--accent`, text `--on-accent`, radius 0.45em, padding
  0.4em 0.85em 0.45em, 0.85rem, weight 500, line-height 1.2, letter-spacing
  0.01em, mono with `--word-spacing-mono`, centred, wraps on words.
- Shadow: `0 8px 18px` 0.22 and `0 2px 4px` 0.18 of `--ground`.
- Tail: 7px CSS triangle in `--accent`, `left: calc(50% + var(--tail-x))`.
- Enter: 0.18s `cubic-bezier(0.22, 0.61, 0.36, 1)` from 8px lower (upper when
  flipped) and scale 0.92, opacity 0 → 1. Reduced motion: opacity only.

## When

- Shown while a mouse pointer is over a card, not dragging, desktop timing.
- Hidden on leave, drag start, section inactive, and unmount.
- `aria-hidden`: the title is already readable in the card.
