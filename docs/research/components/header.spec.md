# Header

Reference: `lib/components/Header.svelte` (+ `directionalFill`, `ctaResonance`, `hoverSound` actions).
Screenshots: `reference-hero.jpg`, `reference-awwwards-hero.jpg`, `reference-menu-open.jpg`.

## Overview

Three independent fixed pieces, not one bar:

1. **Logo** (top-left). Lives outside the header box so it can sit above the phone menu.
2. **Right tabs** (top-right, flush to the edge and the top): the dark upright "Menu" tab and the
   accent upright CTA tab, side by side, text running bottom-to-top.
3. **Phone menu trigger** (≤767 only): a 2.75rem round icon button replacing both tabs.

## DOM

```
a.logo[href="/"][aria-label]            fixed, z 1001
  Wordmark (height 52)
header.header                           fixed top/right, z 999, pointer-events none
  div.rightButtons                      flex row, pointer-events auto
    button.tab (Menu)                   aria-controls="site-menu" aria-expanded
      span.tabBg | span.tabFillWrap > span.tabFill | span.tabContent > (span label, svg 2×2)
    span.ctaSlot[inert when hidden]
      <Button vertical revealed variant="accent" showIcon label={HEADER.cta}>
button.mobileTrigger                    fixed, z 1001, phone only
  span.fillWrap > span.fill | span.content > svg 2×2 (2rem)
```

## Values

| Part | Value |
|---|---|
| Logo box | reference `width: 7rem` image (≈39.5px tall). Wordmark `height=52` gives a ~36px visible mark and ~108px total width. Box offset `-0.25rem` so the visible glyph edge lands where the reference's does: `top/left: calc(var(--offset-x) - .25rem)`; phone `top: calc(.75rem - .25rem)`, `left: calc(var(--offset-x-phone) - .25rem)` |
| Logo motion | hidden `opacity 0; translateY(-120%)`; revealed `opacity 1; translateY(0)`, 760ms `cubic-bezier(.22,1,.36,1)`, delay 80ms |
| Logo tuck on scroll-down (≥768 only) | `translateY(-150%)`, `transform var(--motion-duration-base) var(--motion-ease-standard)` |
| Tab | `width 3.5rem; padding 1.4rem 1.25rem 1.9rem; gap 1rem; font .9rem mono; writing-mode vertical-rl; clip-path var(--clip-corner)`; label `transform: scale(-1,-1)` (reads upward). Small phone ≤390: `1rem`, `3.1rem` |
| Tab colours | bg `--dark`, text `#fff`; fill circle `--accent`; text on fill `--on-accent` |
| Tab fill | circle at pointer entry point, diameter `2 × farthest-corner + 24px`, `translate(-50%,-50%) scale(0→1)`, 720ms `cubic-bezier(.625,.05,0,1)` (transform/width/height) |
| Tab icon | 2×2 squares, `1em`; hover `scale(.7) rotate(90deg)` at `--motion-duration-fast` |
| Tab reveal | `opacity 0; translate3d(shift, -110%, 0)` → `opacity 1; translate3d(shift, 0, 0)`, 640ms `cubic-bezier(.22,1,.36,1)`; delay .18s (menu) unless the preloader has finished (`no-delay`) |
| Sibling hide | fine pointer: hovering one tab slides the other up `translateY(-100%)`, pointer-events none, 640ms same ease |
| Resonance | fine pointer, not reduced motion: `--shift-x` follows pointer X up to ±10px (smoothing .16/frame); press `scale(.982)`; hover/focus = fill shown |
| Phone trigger | `top .5rem; right var(--offset-x-phone); 2.75rem` circle, `mix-blend-mode: difference`, white 2×2 icon 2rem; reveal 640ms, delay .18s; press: content `scale(.84)`, icon tap keyframes 460ms `cubic-bezier(.34,1.56,.64,1)` (1 → .68/-16° → 1.1/8° → 1), accent circle `scale(1)` at opacity .55 |

## States and triggers

- `introPhase ≥ HERO_INTRO_PHASE.logo` → logo revealed.
- Tabs revealed: desktop `introPhase ≥ HERO_INTRO_PHASE.menuButtons`; ≤1024 `≥ HERO_INTRO_PHASE_MOBILE.buttons`.
- `no-delay` when `preloader.leaving || !preloader.visible` (reference: `loadingFinish`).
- Scroll direction: each `stageProgress.global` update sets `tucked = global > previous && global > 0.01`.
  Only the logo reacts, and only ≥768.
- Phone trigger revealed = tabs revealed && menu closed && not closing (`menuPhase === "closed"`).
- Logo on phone while the menu is open or closing: dark-on-light variant (the reference relies on
  `mix-blend-mode: difference` over the white panel; with a two-colour mark that would invert the
  blue to orange, so the variant swaps `--mark-s`/name to `--dark` and `--mark-gap` to white).

## Behaviour

- Logo click: on the stage page (`#stage-scroll-wrapper` present) `preventDefault` and run the smoke
  transition to section 0. Elsewhere the link goes to `/`.
- Menu tab / phone trigger: toggle `menuOpen`.
- CTA tab: smoke transition to `SECTION_INDEX.getIt` (the foreman's mapping; the reference's
  "Connect Now" targets Contact).
- All navigation is skipped while `canScroll` is false (as the reference's `scrollToSection`).
- Hover plays `playSfx("hover")`.

## Accessibility

- Hidden (pre-intro) controls are `inert`.
- Tabs keep a visible focus state (fill shown on `:focus-visible`); phone trigger keeps the global outline.
- Phone trigger `aria-label={HEADER.menu}`; logo `aria-label` "ClearSign, back to the start".
- Reduced motion: transitions collapse to .01ms; no resonance.

## Z-indices

header 999 · menu 1000 · logo and phone trigger 1001 · smoke 1100.
