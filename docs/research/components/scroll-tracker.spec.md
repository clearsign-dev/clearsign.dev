# ScrollTracker (bottom-left)

File: `src/components/chrome/ScrollTracker.tsx` + `ScrollTracker.module.css`.
Reference: `lib/components/ScrollTracker.svelte`, placed by `.mobile-dock` in
`routes/+page.svelte`.

## Placement

| Viewport | Position |
|---|---|
| > 1024px | `fixed`, `left: var(--offset-x)`, `bottom: var(--offset-x)` (1.2rem) |
| <= 1024px | `position: static` - the foreman's mobile dock places it |
| z-index | 101 (the reference dock uses 101 too) |

Text: `var(--font-mono)`, `.875rem`, weight 400, `var(--grey-300)`,
`word-spacing: var(--word-spacing-mono)`, not selectable.

## States

The tracker covers sections 1..7 (the hero is not a tracker entry).
Index = last i >= 1 with `scrollProgress >= SECTIONS[i].start` (0.0001 tolerance on
the first); number = i zero-padded ("01".."07"), label = `SECTIONS[i].label`.

1. **Before section 1** and scrolling is unlocked (`canScroll`): "Scroll down"
   (`SECTIONS[0].label`), desktop only. Fades in 300ms. The word cycles every
   2.2s inside a clip: rest, drops out below (22%->42%->49%: 0 -> 118% -> 136%),
   jumps above (-136% at 50%), falls back in with a small overshoot (12% at 76%,
   -4% at 87%, 0 at 100%), ease-in-out. Font size `var(--text-base)`, line-height 1.2.
2. **Section 1..6**: the box, `NN <diamond> Label`.
3. **Contact** (empty label): nothing is shown, as in the reference.

## Box

`var(--grey-600)` bg, `.5px` border `--grey-300` at 30%, `backdrop-filter: blur(50px)`,
radius `.25rem`, shadow `0 1px 8px rgb(0 0 0 / .04)`, flex, centred, gap `1rem`,
height `1.75rem`, padding `.375rem 1rem`. At <=1024px: min-height `2rem`, padding `0 1rem`.

Diamond: my own 4px CSS square turned 45deg, `#c6c9d6`-ish (`--grey-300`), opacity .7.

## Odometer

Two reels, each a clipped viewport (`height: 1.25em`, `line-height: 1.25`) over a
column of every entry:
- number reel: `2ch` wide, tabular figures;
- label reel: letter-spacing .01em; its viewport width animates to the new
  label's width.

On index change the tracks slide to `-index * itemHeight`:

| Part | Duration | Ease |
|---|---|---|
| number | 580ms | power2.inOut `cubic-bezier(.65,0,.35,1)` |
| label | 720ms | power2.inOut |
| label width | 340ms | power2.out `cubic-bezier(.33,1,.68,1)` |

Durations x1.18 at <=1024px or on touch (`scaleDuration`). A change mid-flight
starts from the current on-screen value. First appearance, re-appearance after
contact, resize and font load snap without animation. Reduced motion: always snap,
no "Scroll down" cycle.

## Accessibility

Reels are `aria-hidden`; a visually hidden polite live region carries the current
number and label.
