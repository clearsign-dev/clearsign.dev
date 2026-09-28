# Brand: the token remap

The rebrand is one operation on the tokens in `src/app/globals.css` and the fonts
in `src/app/layout.tsx`. Components reference tokens, never raw brand values, so
nothing below should appear as a literal anywhere else.

## Colour

The reference's greys are cool and slightly blue, which already sits well with
ClearSign's accent, so they stay: they are structure, not identity. Only the red
moves.

| Role | Reference | ClearSign | Token |
|---|---|---|---|
| Accent (buttons, the "Connect" tab, loader bar, active tick, focus badge) | `#e64749` | `#4aa3c9` | `--accent` |
| Accent, deep end of gradients and pressed states | darker red | `#2d6a8a` | `--accent-deep` |
| Accent glow (preloader grid, halos), rgb triplet | `230 71 73` | `74 163 201` | `--accent-rgb` |
| Page ground | `#000` | `#000` | `--ground` |
| Body background behind the stage | `#20242d` | `#20242d` | `--bg-primary` |
| Heading fill | `rgb(210 215 225)` | same | `--heading-fill` |
| Body copy | `#8a909f` | same | `--text` |
| Secondary copy | `#a8aebc` | same | `--grey-300` |
| Muted | `#606372` | same | `--grey-100` |
| Hairline | `rgba(255,255,255,.2)` | same | `--hairline` |
| Card surface | `rgba(43,44,48,.6)` | same | `--grey-600` |
| Dark panel | `#121214` | same | `--dark` |
| Severity CRITICAL / BLIND (content, not chrome) | — | `#e5484d` / `#d9a23a` | `--sev-critical`, `--sev-blind` |

The severity colours exist because the proof section prints ClearSign's real
output, where CRITICAL has to read as an alarm. They are content colours, used
only inside output blocks, never for chrome.

## Type

| Role | Reference | ClearSign |
|---|---|---|
| Display headings (uppercase) | KH Interference TRIAL | **IBM Plex Mono**, 500 |
| Interface: labels, meta, buttons, counters, the tracker | IBM Plex Mono | IBM Plex Mono |
| Paragraphs | IBM Plex Mono with `word-spacing: -0.35em` | **IBM Plex Sans**, normal word spacing |
| Hashes, addresses, commands, output | — | IBM Plex Mono |

The display choice is inferred. The brief names Plex Sans for text and Plex Mono
for code but says nothing about display type. Mono was chosen because it keeps
the reference's square, instrumental headline texture, and because it is the face
ClearSign already uses for the thing it is about: the bytes. Plex Mono sets wider
than KH Interference (0.6em per glyph against roughly 0.52em), so headline sizes
are scaled by about 0.87 to keep the same line lengths.

Fonts load through `next/font/google`, which downloads them at build time and
serves them from this site. No request goes to Google at runtime.

## Mark

`brand/clearsign-mark.svg` geometry, rebuilt as a React component so it takes its
colours from the page:

- `--mark-c` (the aperture) = `--accent`
- `--mark-s` (the signature) = near-white ink `#e8ecef`
- `--mark-gap` = whatever it sits on, or the S merges into the C

The header wordmark is the mark plus "ClearSign" in Plex Sans 600, tracking
`-8/300` em, the same construction as `brand/clearsign-wordmark.svg`.

## What stays the reference's

Layout, spacing, the section anatomy, the scroll timeline, every easing and
duration, the clipped-corner buttons, the tick-mark scroll indicator, the
vertical tabs, the concentric circles and plus markers, the per-character
heading reveal, the custom cursor, and the preloader's structure.
