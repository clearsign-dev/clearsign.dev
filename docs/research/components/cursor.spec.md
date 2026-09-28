# Cursor

`src/components/chrome/Cursor.tsx` + `Cursor.module.css`. `export function Cursor()`.

Reference: `lib/components/Cursor.svelte`, `lib/utils/actions/ctaResonance.ts` (the
hover pulse it dispatches). Screenshots: the white dot in `reference-intro-octagon.jpg`.

## What it is

A 1.2rem dot in the ink colour that follows a fine pointer with a short lag,
blended with `mix-blend-mode: difference` so it inverts whatever is under it.
It grows, hides, carries a label, and throws a ripple on click.

## When it exists

- Mounted only when `(hover: hover) and (pointer: fine)` matches. Nothing is
  rendered on touch, and the native cursor is never touched there.
- Touch pointer events on hybrid devices are ignored.
- Before the first pointer move the dot is hidden (the reference leaves it
  parked in the top-left corner; we don't).

## Native cursor

The native cursor is hidden (a class on `<html>`: `cursor: none !important` on
everything) **only while the dot itself is showing**. It comes back when:

- the pointer leaves the window (`pointerout` with no related target);
- the pointer is over a form field (`input, textarea, select, [contenteditable]`);
  those always keep their native cursor, even while the class is on;
- the dot is hidden for any other reason below (label shown, `data-cursor-hide`);
- the element under the pointer sits in a layer stacked above the cursor
  (any ancestor with a z-index above the cursor's, e.g. the preloader), so the
  dot would be invisible.

## States

| State | Trigger | Look |
|---|---|---|
| rest | default | 1.2rem dot |
| pointer | over `a[href]`, enabled `button`, `[role=button]`; or `cursor.active`; or any label | grows to 2.4rem (0.16s ease), follow is snappier |
| hidden | no position yet, outside window, form field, `[data-cursor-hide]`, anchored label, covered | core fades to 0, scales to 0.38, blurs 3px (0.26s / 0.22s) |
| grab | over `[data-cursor="grab"]`, not in pointer state | ~2.16rem |
| grabbing | pointer pressed inside a grab zone, until release | ~1.68rem, accent fill, normal blend |

Sizes come from a fixed 2.4rem disc scaled (0.5 rest, 1 pointer, 0.9 grab,
0.7 grabbing), so the disc is always rasterised at its largest size.

## Follow

Per frame: `k = 1 − (1 − s)^(dt / 16.67)`, `dt` capped at 40ms and the ratio
at 2.4; `s = 0.32` at rest, `0.42` in pointer state; snap when within 0.08px.
The loop runs only while the dot is catching up. Reduced motion: `k = 1`.

## Labels

Two kinds, both a pill: accent background, `--on-accent` text, mono 0.9rem with
the mono word spacing, radius 0.25em, padding 0.3em 0.75em 0.4em. Entry: 0.22s
`cubic-bezier(0.22, 0.61, 0.36, 1)` from 6px lower at 0.92 scale and 0 opacity.

1. **Anchored** — the pointer is inside an element carrying
   `data-cursor-label="…"` (found with `closest`). The pill sits 12px to the
   right of the element's resting box (its own transform translation stripped,
   so magnetic buttons don't drag it), vertically centred; to the left instead
   when the element's right edge is past 70% of the viewport. The dot hides and
   the native pointer takes over. Measured once per element entered.
2. **Following** — `cursor.label` in the store is set by some component. The
   pill rides 24px below the dot, centred. Re-enters when the text changes.
   An anchored label wins over a following one.

Labels are hidden while over `[data-cursor-hide]`, while covered, and while
grabbing. They are `aria-hidden`: the controls carry their own names.

## Store

`cursor` from `lib/stage/store`: `label` → following label; `active` → pointer
state. Read-only here.

## Bursts

- **Click ripple**: at the click point, a 1.2rem ink dot at 0.9 alpha scales
  1 → 3 and fades over 0.45s ease-out. Skipped for keyboard clicks (`detail 0`).
  After a click the hover state is re-read from the point, since clicks often
  change the DOM under the pointer.
- **Hover pulse**: on the window event `cursor:hover-anim` with
  `{ x, y }` (the centre of the control), a 1.4rem ring with a 1px 42%-ink
  border goes from 0.55 opacity at 0.96 scale to 0 at 1.32 over 0.3s. Exported
  as `CURSOR_PULSE_EVENT`, with helpers `pulseCursor(x, y)` and
  `pulseCursorAround(element)` for the button to call on pointer enter.

Both are skipped under reduced motion.

## Stacking

All layers are `position: fixed`, `pointer-events: none`, siblings (no wrapper,
which would isolate the blend mode). z-index: bursts 9989, dot 9990, labels
9991 (`CURSOR_Z_INDEX = 9990`). The menu must be below 9989, the preloader
above 9991. Mount it outside any stacking context (a direct child of `body`),
otherwise the difference blend only sees that context.

## DOM hooks for other builders

- `data-cursor-label="Proceed"` — anchored label (Button already emits it).
- `data-cursor-hide` — hide the dot and show the native cursor while the
  pointer is anywhere inside the element (`closest`). The audio pill uses it,
  as the reference hides its cursor there; the reads hotspot buttons should
  too (the reference does, so the inverted dot doesn't spoil their own icon
  animation).
- `data-cursor="grab"` — grab / grabbing looks (slider).

## Reduced motion

No lag, no bursts, no transitions on size or visibility, labels appear without
the rise.
