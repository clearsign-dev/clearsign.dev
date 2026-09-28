# /privacy

Reference: `routes/privacy-policy/+page.svelte`, screenshot
`docs/design-references/reference-privacy.jpg`. Copy: `PRIVACY` in `src/lib/content.ts`.

## What the reference does

A plain legal page on black. One narrow centred column, no chrome (no header,
cursor, sound or ruler), no motion. It scrolls, and its text is selectable.

Top to bottom:

1. `← Back to home`, a small grey link to `/`.
2. `PRIVACY POLICY`, large display type.
3. The organisation name, grey, one step above body size.
4. `Last updated: 05.06.2026`, small, muted.
5. Sections: display-type `h2`, then paragraphs and bullet lists whose bullets
   are small red dots.

The reference pins its own fixed scroll container because its home runtime
leaves `html/body` at `overflow: hidden`. Ours does not need that: the stage
restores both on unmount, so this page uses normal document scroll.

## Measurements (reference values)

| Element | Value |
|---|---|
| Page padding | `6rem 1.2rem 8rem`; ≤1024: `4.5rem 1.25rem 6rem` |
| Column | `max-width: 60rem`, centred (x = 276px at 1512 wide) |
| Background / text | `#000` / `#fff`, weight 300, word-spacing normal |
| Back link | inline-block, `0.85rem`, `letter-spacing: .04em`, grey-300, hover white (fine pointers only), `margin-bottom: 3rem`, `transition: color .25s ease` |
| Header block | `margin-bottom: 3.5rem` |
| `h1` | `clamp(2rem, 6vw, 3.5rem)`, line-height 1.05, `margin: 0 0 1rem`, white |
| Organisation | `1.1rem`, grey-300, `letter-spacing: .02em`, `margin: 0 0 .35rem` |
| Updated | `0.85rem`, grey-100, margin 0 |
| Section | `margin-bottom: 2.75rem`, last 0 |
| `h2` | `clamp(1.1rem, 2.5vw, 1.6rem)`, line-height 1.15, `margin: 0 0 1rem` |
| `p` | `1rem`, line-height 1.7, `rgba(255,255,255,.78)`, `margin: 0 0 1rem`, last 0 |
| `li` | as `p` but line-height 1.6, `padding-left: 1.4rem`, `margin-bottom: .5rem` |
| Bullet | `0.4rem` circle, red, `left: 0; top: .65em` |

## ClearSign version

Tokens only:

| Reference | Ours |
|---|---|
| `#000` ground | `var(--ground)` |
| `#fff` headings | `var(--ink)` |
| grey-300 / grey-100 | `var(--grey-300)` / `var(--grey-100)` |
| red bullet | `var(--accent)` |
| KH Interference headings | `var(--font-display)`, `var(--display-weight)`, uppercase (global `h1,h2`) |
| Plex Mono paragraphs | `var(--font-sans)` 400 (Plex Sans 300 is not loaded), word-spacing normal |
| Plex Mono back link, subtitle, date | `var(--font-mono)`, word-spacing normal |

Display sizes are scaled by 0.9 for Plex Mono's wider set, as the tokens do
(`--h1-size` 180 against the reference's 200): `h1`
`clamp(1.8rem, 5.4vw, 3.15rem)`, `h2` `clamp(1rem, 2.25vw, 1.45rem)`.

Content, all from `PRIVACY`:

- Back link: `← Back to home` (the string the brief for this page specifies), `href="/"`.
- `h1`: `PRIVACY.title` (one line per entry).
- Subtitle: `ClearSign`.
- Updated: `Last updated: {PRIVACY.updated}`.
- One section of three paragraphs, `PRIVACY.paragraphs`. The content has no
  section headings, so none are invented. The `h2` and bullet styles exist in
  the module so the page keeps the reference's scale if a heading or a list is
  ever added to the content.

## Behaviour

- Server component; nothing on this page needs the client.
- `export const metadata = { title: "Privacy — ClearSign", description: PRIVACY.paragraphs[0] }`.
- The article carries the global `selectable` class (the body is `user-select: none`).
- Normal document scroll; `min-height: 100dvh` so the black ground always fills
  the viewport over the body's `--bg-primary`.
- Native cursor. No reveal motion (the reference has none), so reduced motion
  needs nothing beyond the colour transition, which is left as is.

## Files

- `src/app/privacy/page.tsx`
- `src/app/privacy/privacy.module.css`
