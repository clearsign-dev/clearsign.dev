# Scrollbar (right edge)

File: `src/components/chrome/Scrollbar.tsx` + `Scrollbar.module.css`.
Reference: `lib/components/Scrollbar.svelte`.

## Placement

| Property | Value |
|---|---|
| position | `fixed`, `top: var(--offset-x)`, `bottom: var(--offset-x)`, `right: 0` |
| hit area width | `.875rem` |
| z-index | 104 |
| phones (<=767px) | not shown (the audio button lives in that corner) |

## Parts

- Track: centred in the hit area, `2px` wide, full height, pill radius,
  `rgb(255 255 255 / .12)`.
- Thumb: `4px x 3.5rem`, centred, pill radius,
  `linear-gradient(180deg, rgb(var(--accent-rgb) / .65), var(--accent))`,
  glow `0 0 12px rgb(var(--accent-rgb) / .45)`. `translateY(p * (track - thumb))`
  where p = `scrollProgress` (raw 0..1), written directly to the DOM each change.
- Hover or drag: thumb `6px` wide (stays centred), glow `18px / .6`;
  200ms outQuart on width/right, 200ms ease on the glow.

## Visibility

`opacity: 0` by default but still hoverable, so the bar reappears when the
pointer reaches the edge. Shown (`opacity: 1`, 320ms outQuart) when the intro
has revealed the peripheral UI **and** any of:
- scroll progress changed within the last 1100ms (idle timer restarts on each change),
- hovered,
- dragging.

Intro gate as the ruler: `introPhase >= HERO_INTRO_PHASE.uiGroup` on desktop,
`>= HERO_INTRO_PHASE_MOBILE.scrollIndicator` at <=1024px.

## Drag

- Primary pointer down anywhere in the hit area: capture the pointer, jump
  immediately (`goToProgress(p, { immediate: true })`), cursor `grabbing`.
- Move: throttled to one call per animation frame.
- `p = clamp01((y - top - thumb / 2) / (height - thumb))`, so the thumb centre
  follows the pointer.
- Up / cancel: release; the idle timer restarts so the bar lingers 1.1s.
- Cursor: `grab`, `grabbing` while dragging.

## Accessibility

`role="scrollbar"`, vertical, `aria-controls="stage-scroll-wrapper"`,
`aria-valuenow` 0..100, `tabIndex={-1}` (keyboard users have the ruler and the
stage's own keys). Label is functional ("Page scroll progress").
