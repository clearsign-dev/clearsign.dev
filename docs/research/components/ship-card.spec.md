# ShipCard

Reference anatomy: `lib/components/Card.svelte` + `cardReveal.ts` + `Tag.svelte`.
Data: one entry of `SHIPS.cards` (`id`, `name`, `detail`, `status`, `icon`).

Files: `src/components/ships/ShipCard.tsx` + `ShipCard.module.css`,
`src/components/ships/ShipIcon.tsx`, `src/components/ships/cardReveal.ts`.

## DOM

```
article.slot [data-ship-card]            measured for the reveal, never transformed
  div.surface [data-reveal=surface]      reveal: slide, scale, blur
    div.card                             hover tilt + press, glow layers
      div.number [data-reveal=number]    "01" (display face) + "/ 4"
      div.titleRow
        h3.name [data-reveal=description]
        span.tag [data-reveal=type]      status, e.g. "Unsigned"
      div.icon > div [data-reveal=icon] > div.iconInner > ShipIcon
      p.detail [data-reveal=description]
```

## Layout

Card: `--grey-600` surface, `padding: 1rem`, `gap: 1rem`, clipped on two
opposite corners (top-left and bottom-right, 1rem), soft inset hairline and
drop shadow from `--ink`/`--ground` mixes. Grid:

| | desktop (≥ 1025) | ≤ 1024 |
|---|---|---|
| size | `width: 47vw; aspect-ratio: 3/2` | tablet `min(48vw, 380px, 44svh)`, phone `min(71.2vw, 320px)`; `aspect-ratio: 320/329` |
| areas | `"number title" / ". ." / ". detail"`, columns `1fr 48%` | `"number tag" / "title title" / "icon icon" / "detail detail"` |
| title row | name + tag side by side, hairline under both | `display: contents`: tag beside the number, hairline under the name |
| icon | absolute, centred, `width: 20%` | in flow, fills the leftover row; svg `height: 70%`, `max-width: 60%` (the reference's 42% assumed no note under it) |

Name: mono `1.25rem/1.2`, `--ink`, not uppercased (overrides the global h3).
Number: id in `--font-display` `1.7rem` (`text-3xl` × 0.9), `--ink`; "/ N" in
mono `--grey-300`. Tag (implemented here, not `ui/Tag`): mono `0.875rem`,
`padding: 0.375rem 0.75rem`, radius 4px, `--ink` at 10% with a 50px backdrop
blur, nowrap. The header row wraps on narrow cards so the tag drops a line
rather than overflowing (≤ 380px: number, tag, name each on their own row).
Detail: `--font-sans`, `--grey-300`, `0.9375rem/1.4` (tablet `0.875rem`,
phone `0.8125rem`), normal word spacing. Desktop's right column is
`minmax(48%, max-content)`, so name and tag stay on one line whenever the card
is wide enough; the note fills that column without widening it
(`contain: inline-size`).

## Icons (`ShipIcon`)

Own drawings, 64-unit viewBox, `stroke: var(--ink)`, 1.5px non-scaling stroke,
no fill, round joins. `desktop`: monitor, one interface rule, stand and foot.
`terminal`: window, title rule, prompt chevron, cursor bar. `chip`: package,
die, three pins per side. `layers`: three stacked isometric plates.
Decorative (`aria-hidden`).

## Reveal (per card, driven from `useShipsColumn`)

Progress from the slot's viewport position, from 92% to 16% of the viewport:

- desktop: `(0.92 vh − rect.top) / (0.92 vh − end)`,
  `end = 0.16 vh` (last card: `max(0.16 vh, vh − rect.height)`)
- ≤ 1024: the same on `rect.left` against the viewport width.

Progress is damped (110ms desktop, 110 × 1.65ms mobile) and mapped onto the
item timeline `t = p × max(end)` over `SHIPS_TIMING.*.cardItems`. Each item's
local value `clamp((t − start) / (end − start))` is eased with power2.out
(`1 − (1 − x)^3`) and written as opacity, transform and filter; `visibility:
hidden` until the item's beat starts.

| item | desktop from | ≤ 1024 from (sign: even index −1, odd +1) |
|---|---|---|
| surface | x −20%, scale 0.94, blur 12px | y ±24%, scale 0.94, blur 12px |
| number | x −12% | y ±18% |
| type (tag) | x −10% | y ±14% |
| description (name, detail) | x −14%, blur 4px | y ±16%, blur 4px |
| icon | x −18%, scale 0.94 | y ±22%, scale 0.94 |

Blur is skipped on touch devices. Reduced motion: no reveal styles at all.

## Hover and press (fine pointers only, not under reduced motion)

Pointer position in the card, −0.5..0.5, eased 0.12 per frame toward the target.
`rotateX(−y × 6.4°) rotateY(x × 6.4°)`, shift ±11px, icon shift ±14px,
icon scale `1.012 + 0.028 i`, icon depth `24 + 9 i` px, glow alpha
`0.1 + 0.19 i` (i = pointer distance from centre, normalised). Two glow layers:
a white radial at the pointer blending into `--accent-rgb`, and a diagonal sheen.
Hover shadow deepens with an accent tint. Press: scale 0.975; release bursts to
1.018 then settles to 1 after 130ms. Hover plays the `hover` sfx.
