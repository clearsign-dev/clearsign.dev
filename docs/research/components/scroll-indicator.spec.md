# ScrollIndicator (tick ruler)

File: `src/components/chrome/ScrollIndicator.tsx` + `ScrollIndicator.module.css`.
Reference: `lib/components/ScrollIndicator.svelte`, fed by `routes/+page.svelte`.

## Placement

| Property | Value |
|---|---|
| position | `fixed`, `top: var(--offset-x)` (1.2rem), `left: 50%`, `translateX(-50%)` |
| size | `23.5rem` x `2rem`, `padding: 0 1.4rem`, `border-box` |
| z-index | 99 |
| phones (<=767px) | not shown (`display: none`); the loop does not run |

The audio pill is **not** grouped with it in the reference. It is its own fixed
element at `top: 1.2rem; left: calc(50% + 23.5rem / 2 + 6px)`: the ruler stays
centred on the viewport and the pill hangs 6px off its right edge.

## Surface

- radius `.25rem`; background: vertical gradient `rgb(46 48 54 / .94)` ->
  `rgb(27 29 34 / .98)` over `rgb(43 44 48 / .95)`; shadow `0 .8rem 2rem rgb(0 0 0 / .24)`
  plus a 1px inset top highlight `rgb(255 255 255 / .05)`.
- "hovered" (a section is emphasised): lighter gradient `rgb(55 57 63 / .98)` ->
  `rgb(31 33 39 / .98)`, bigger shadow, 1px ring `rgb(255 255 255 / .04)`.
- These neutrals are local to the component (not brand tokens).

## Enter

Hidden: `opacity 0`, `translateY(12px)`, no pointer events. Visible when
`introPhase >= HERO_INTRO_PHASE.uiGroup` (desktop) or
`>= HERO_INTRO_PHASE_MOBILE.scrollIndicator` (<=1024px). Transition 700ms
`cubic-bezier(.22,1,.36,1)` on opacity and transform; when becoming visible
opacity is delayed 120ms.

## Ticks

- One big tick per section (8), three small between each pair (21): 29 total,
  flex row, `justify-content: space-between`, centred vertically.
- Big: a `<button>` with `padding: 0 .6rem` (first: no left pad, last: no right
  pad); line `2px x .9rem`, pill radius.
- Small: `margin-left: .6rem` (none right after a big tick); line `2px x .6rem`.
- Line colour `rgb(255 255 255 / .65)`, `opacity: var(--tick-opacity)` (rest .6).
- Active section (= `stageProgress.step`): `var(--accent)`, opacity 1, glow
  `0 0 14px rgb(var(--accent-rgb) / .28)`.
- Emphasised tick: near-white `rgb(255 255 255 / .98)`, opacity 1, white glow.
- Tick centres are measured as the centre of the tick element **including its
  padding** (as the reference), so the first/last centres sit 0.3rem inside the line.

## Magnifier wave

While the pointer is inside, or a tick is emphasised, each tick is scaled by a
wave centred on a sprung "focus" x (spring: stiffness .18, damping .86, precision .01;
target = pointer x, else the emphasised tick's centre):

```
x = |centre - focus| / R      R = 70px big, 60px small
w = (1 - x^2) * exp(-x^2 / 2)
scale   = max(.4, 1 + w * (.85 big | .65 small))
opacity = min(1, .25 + max(0, w) * .75)
glow    = max(0, w) * (.5 big | .2 small)       -> box-shadow + saturate
```

Otherwise: scale 1, opacity .6, glow 0. Line transitions: transform/opacity/filter
.6s outQuart, colour/shadow .3s; while the pointer is inside the first three are 0s.

## Emphasis (hover label)

Absolute, `top: 50%`, x = focus clamped to [first centre, last centre] while
interacting, else the last emphasised tick's centre; `translateX(-50%)`.
Column, gap .45rem:
- beam: `2.9rem x 1.8rem` pill, radial accent glow (.32 -> .18 -> transparent 76%)
  over a faint white top gradient, blur 1px, centred on the ruler
  (`translateY(-50%)`), breathes 2.4s (scale .94<->1.06, opacity .72<->1).
- label: pill, `var(--accent)` bg, `var(--on-accent)` text, `.62rem`, tracking
  .12em, uppercase, padding `.24rem .58rem .28rem`; hidden `scale(.92)`, shown
  `scale(1)` opacity .96, 220ms outQuart. Text = `SECTIONS[i].indicatorLabel`.
- The whole emphasis fades 180ms.

Emphasised section = hovered ?? keyboard-focused ?? (pointer inside ? active : none).

## Position cursor (head)

Two small marks (my own drawing: flat bar + needle, `.8rem` wide, `var(--grey-100)`),
one at the top edge pointing down, one at the bottom pointing up; opacity .8.
Hovered: opacity 1 + accent drop-shadow 12px/.42; dragging: 6px/.5.

It tracks **reveal**, not raw scroll. Track (global progress -> px):
- `S0.start` -> centre 0;
- for each i >= 1: `Si.start` -> centre i-1, then
  `Si.start + (Si.end - Si.start) * reveal[i]` -> centre i;
- `S7.end` -> centre 7. Piecewise linear between points.

`reveal = SECTION_REVEAL_COMPLETE.mobile` at <=1024px else `.desktop` (same table the
stage uses to land a tick click). Head x is sprung (stiffness .2, damping .88);
hard-set while dragging and on first measure.

## Interaction

- Enter: pointer x becomes the focus (hard), the nearest big tick is hovered.
- Move (not pressed): hovered = nearest big tick by pointer x.
- Press + move > 6px: drag. Pointer x -> progress by the inverse track (the
  *first* segment that reaches x, so a tick lands on its reveal-complete point),
  `goToProgress(g, { immediate: true })`. Crossing to a new nearest tick pulses
  it (.35s: scale 1.4 + accent -> normal) and plays `hover` sfx; the hovered tick
  follows the drag. Cursor `grabbing`.
- Release without drag: `goToSection(pressed tick ?? nearest tick)`.
- Keyboard: ticks are a roving-tabindex group; Left/Right/Home/End move focus,
  Enter/Space -> `goToSection`. Focus-visible emphasises the tick (label shows).
- The reference hides its custom cursor over the ruler: the wrap carries
  `data-cursor-hidden`.

## Reduced motion

Springs snap, no breathe/pulse, no CSS transitions on the ticks/emphasis.
