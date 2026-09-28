# WarningPanel

The brief requires the warning near any download. It has no reference
counterpart; it is dressed in the reference's panel language (the tracker and
card surfaces).

File: `src/components/getit/WarningPanel.tsx` + `WarningPanel.module.css`.
Data: `GET_IT.warning` (`label`, `headline`, `body`), never reworded.

## DOM

```
div.panel role="note" aria-labelledby=<label id>
  p.label     small caps kicker
  p.headline  prominent
  p.body
```

## Style

- Surface `--grey-600` with a 24px backdrop blur (dark glass over the scene).
- Hairline inset: `inset 0 0 0 1px` and a 1px top highlight, both `--ink`
  mixed down to a few percent, plus a soft drop shadow toward `--ground`.
- Left edge: 2px `--sev-blind` rule down the full height, at 0.9 opacity —
  the only colour on the panel.
- Radius 0.375rem. Padding `1.25rem 1.5rem 1.375rem 1.625rem` (desktop),
  `0.875rem 1rem 1rem 1.125rem` (≤ 1024).
- Label: mono `0.75rem` (≤ 1024 `0.6875rem`), uppercase, `letter-spacing: 0.08em`, normal word
  spacing, `--grey-300`.
- Headline: `--font-sans` 500, `1.25rem/1.3` (≤ 1024 `1rem`), `--ink`,
  `text-wrap: balance`.
- Body: `--font-sans`, `0.9375rem/1.5` (≤ 1024 `0.8125rem/1.45`), `--grey-300`,
  `text-wrap: pretty`.
- Short mobile viewports (`max-height: 640px`): tighter padding and body
  `0.75rem` so the panel, the cards and the heading still fit.

## Motion

Revealed by the section with the cards' reveal value `r`:
`opacity: r; transform: translate3d(0, (1 − r) × 24px, 0)`; `none` once
settled. Reduced motion: opacity only.

## Placement (set by GetIt)

Desktop: right half, bottom-aligned with the card strip, `z-index` above it.
≤ 1024: directly above the stacked cards, in flow, never overlapped.
