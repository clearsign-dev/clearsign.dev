# Slide card (replaces the reference's image-texture slides)

File: `src/components/evidence/SlideCard.tsx` (+ `.module.css`).
Data: one entry of `EVIDENCE.slides` (`kicker`, `figure`, `title`, `body`,
optional `gap: true`).

## Size and placement

Width and height come from the train (`--card-w`, `--card-h`); the card is
positioned only by `transform` written each frame. `container-type:
inline-size` so all type scales with the card (`cqi`).

## Surface (reference card language, `Card.svelte`)

- Background `--grey-600` with a faint 135deg highlight
  (`--hairline` at ~30% → transparent at 44%).
- Hairline inset: `inset 0 1px 0` and `inset 0 0 0 1px` from `--hairline` at
  low alpha.
- Clipped corner: `clip-path: var(--clip-corner)` (bottom-right 1rem cut).
- Pointer glow (desktop hover): a soft radial highlight at the pointer, tinted
  with `--accent-rgb` at 0.1 (the reference tints with red).

## Focus treatment (reference slide material)

- Non-focused cards dim: overlay of `--ground` at `(1 - focus) x 0.38`
  (brightness mix 0.62 → 1) plus an inner vignette at `(1 - focus) x 0.32`.
- Kicker dot mixes from `--grey-100` to `--accent` with focus.
- <=1024, focused card: a slow accent hairline pulse (the reference's mobile
  click-hint border pulse, sin(3.1 t)); off for reduced motion.
- Keyboard focus: accent inset ring when the carousel has `:focus-visible`.

## Content layout

```
[● KICKER                        03 / 08]
                 (space)
[FIGURE (display)]   [Title (sans 500)]
                     [Body (sans, --text)]
```

- Kicker: mono, uppercase, 11-13px, `--grey-300`, dot 6px.
- Index: mono, `--grey-100`, tabular.
- Figure: `--font-display`, weight 500, `--heading-fill`, uppercase, size
  `min(13cqi, 75cqi / chars)` (desktop/tablet) so the longest ("6 x 3,000")
  fits its half column; phone `min(24cqi, 142cqi / chars)`.
- Title: `--font-sans` 500, `--ink`, `clamp(14px, 2.7cqi, 26px)`; the global
  h3 display styles are reset.
- Body: `--font-sans`, `--text`, `clamp(12px, 1.85cqi, 17px)`, line-height 1.4.
- Phone (<=767): one column: header, figure, title, body.

## "Not true yet" (`gap: true`)

- Restrained `--sev-blind` 2px left edge at 70% and `--sev-blind` kicker text
  and dot. Nothing else changes: no fill, no glow, no badge colour.

## Semantics

`role="group" aria-roledescription="slide" aria-label="k of n"`, title as `h3`,
body as `p`; all text is real text.
