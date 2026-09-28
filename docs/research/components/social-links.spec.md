# SocialLinks

Reference: `lib/components/Socials.svelte`; contact overrides in `Contact.svelte`;
menu usage `<Socials theme="dark" />` in `Menu.svelte`. Screenshots:
`reference-contact.jpg` (three small bordered squares, bottom left),
`reference-menu-open.jpg` (three larger squares on the light menu panel).

## Overview

A row of square icon links. Hovering floods the square with a circle that grows
from the pointer's entry point, and the glyph flips colour against it.

## DOM

```
div.socials.light|dark[.compact]
  a.item[href][target=_blank][rel][aria-label]
    span.bg              (currentColor, opacity 0)
    span.circleWrap      aria-hidden
      span.circle
    span.icon            svg glyph, aria-hidden
```

## Values

- Row: flex, gap .5rem (compact .45rem). Light theme text `#fff`; dark theme `#000`
  and, ≤1024px, `padding-bottom: 1rem; border-bottom: 1px solid #ccc`.
- Item: `width: 3.5rem; aspect-ratio: 1; border-radius: .25rem; background: rgba(255,255,255,.1)`;
  flex centre; `overflow: hidden`. Dark theme: `background: rgb(41 41 46 / .1)` (grey-400/10%), fill `var(--grey-400)`.
- Compact (the contact panel): `width: 2.65rem; border: 1px solid rgb(168 174 188 / .28); background: rgba(255,255,255,.08)`; glyph .92rem.
- Circle: `--button-circle-*` from the pointer; `min-width/min-height: calc(220% + 1rem)`;
  `scale(0)` → `scale(1)`; transform/width/height .72s `cubic-bezier(.625,.05,0,1)`.
  Fill: `#fff` (light) / `var(--grey-400)` (dark).
- Glyph: height 1.25rem (phone 1rem); colour transition .4s ease-in-out.
  Hover glyph: `var(--dark)` on the light theme (the contact sets `#000`), `#fff` on the dark theme.

## Behaviour

- mouseenter / mouseleave: centre the circle on the pointer (directional fill),
  play `playSfx("hover")` on enter.
- The custom cursor steps aside over the squares, as on the reference (which
  fires `cursor:set-hidden`); here each link carries `data-cursor-hide`, the
  cursor's own hook for that.
- Focus-visible shows the same fill as hover.
- Links open in a new tab with `rel="noopener noreferrer"`.

## Content

`SOCIALS` from `lib/content.ts` (GitHub only). The GitHub glyph is the CC0
simple-icons mark. `aria-label` is the entry's label.

## Props

`theme?: "light" | "dark"` (default light), `compact?: boolean`, `className?`.
