# Slide focus badge (reference: `lib/components/SlideFocusBadge.svelte`)

File: `src/components/evidence/SlideFocusBadge.tsx` (+ `.module.css`).

Mobile only (<=1024): a pill pinned above the slider, under the description,
that names the centred slide. (The reference ships the component with its
markup commented out; the brief asks for it, so it is built as designed.)

## Props

- `index` — hysteresis focus index from the train (switches once the visual
  index is 0.7 slide into a neighbour).
- `slides` — `EVIDENCE.slides` (for the kicker).
- `visible` — the train is on screen.
- `reveal` — the section's content reveal (`contentUi`); the badge fades with
  the section, not the moment the train appears.

## Look

- `margin-top: 2.5rem`, `padding: 6.7px 17.86px`, `border-radius: 4.47px`.
- Background `--accent`, text `--on-accent` (the reference: red / white).
- `--font-mono`, 0.9375rem, line-height 1.25, letter-spacing 0.01em,
  `word-spacing: var(--word-spacing-mono)`.
- Shadow: `0 8px 18px` at 0.22 and `0 2px 4px` at 0.18 of `--ground`.
- `pointer-events: none`. Hidden at >1024.
- Content per item: "03 / 08" (count at 70%) then the kicker.

## Reel

- A clip viewport (`overflow: hidden`, max 16rem) over a track with a fixed
  14rem wrap width (so every item measures the same regardless of the
  animating viewport). Items clamp to two lines, `width: fit-content`.
- On index change: viewport width/height tween 0.34s power2.out; track
  `translateY(-(item.offsetTop - first.offsetTop))` tween 0.72s power2.inOut.
- A running tween is committed (`commitStyles`) and cancelled before the next,
  so rapid changes continue from the current visual state.
- First sync after becoming visible, on resize, and after fonts load: set
  without animation. Reduced motion: always set without animation.

## A11y

The pill is `aria-hidden`; the carousel's own live region announces slides.
