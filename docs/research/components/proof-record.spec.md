# Record panel (Proof, added)

Not in the reference. Built in its card language (the Services cards' surface) to show
the Bybit record ClearSign reads, next to the claim.

File: `src/components/proof/RecordPanel.tsx` + `RecordPanel.module.css`.
Copy: `PROOF.record` (title, rows, output, verdict, footnote), `PROOF.severities`,
`PROOF.exitCodes`.

## Anatomy

```
article.panel  (aria-labelledby title)
  h3.title                     record.title, small caps label
  dl.rows
    div.row ×6                 dt label (--grey-300) | dd value (mono, selectable)
  div.output
    p.line                     chip [CRITICAL] (--sev-critical) + code SAFE_DELEGATECALL
    p.verdict                  record.verdict, display type, --sev-critical
  p.footnote                   record.footnote
  div.legend                   (not on phones)
    ul.chips                   [INFO] [WARNING] [CRITICAL] [BLIND], each focusable,
                               its text in a tip shown on hover / focus
    p.exit                     PROOF.exitCodes
```

## Surface

`linear-gradient(145deg, rgb(255 255 255/.065), transparent 42%), var(--grey-600)`,
`box-shadow: inset 0 0 0 1px rgb(255 255 255/.045)`, radius .75rem, blur(14px) behind
(the 3D scene shows through), padding 1rem 1rem 1.1rem. Hairline dividers
(`var(--hairline)` at 50%) above the output and above the legend.

| | desktop (≥1025) | tablet | phone |
|---|---|---|---|
| width | `min(30rem, 44vw)` (clear of the bottom-right statement at 1025) | `min(34rem, 100%)` | 100% |
| label column | 9.5rem | 9.5rem | 8.5rem |
| ≥2245 | `min(40rem, 44vw)`, type ×1.3 | | |

Type: title .6875rem mono uppercase, .08em tracking, `--grey-300`. Rows .75rem/1.4,
row gap .4rem, label mono (interface voice), value mono `word-spacing: normal`,
`white-space: pre-wrap` (keeps the selector's double space), `var(--ink)`.
Footnote sans .6875rem/1.45 `--grey-100`. Exit line mono .6875rem `--text`.

## Values

- Hashes and addresses (`/^0x[0-9a-f]{24,}$/i`) are shortened in the middle by CSS: the
  full string is in the DOM as head + last 6; the head is capped at 10ch with an ellipsis.
  `title` carries the full value; `user-select: all`, so one click selects the whole
  value and copying gives the full string; screen readers read it in full.
- Everything else prints as given.

## Chips

`[SEVERITY]`, mono .6875rem, `word-spacing: normal`, colour `var(--sev-*)`, background
`color-mix(in srgb, var(--sev-*) 12%, transparent)`, inset 1px ring at 30%, radius .25rem.
Legend chips: `tabIndex=0`; the text sits inside each chip in a tip (opacity 0 → 1 on
hover / focus-visible, above the chip, `var(--dark)` with a hairline ring, sans .72rem),
so screen readers read "[INFO] Nothing alarming" in line.

## Reveal (scroll-scrubbed; p = the button beat + .06 lag)

`q(s, span) = smoothstep((p − s) / span)`

| part | value |
|---|---|
| panel | opacity q(0, .5); `perspective(900px) translate3d(0,(1−q)·28px,0) rotateX((1−q)·4deg) scale(.975+.025q)` |
| title | q(.1, .4), rises 10px |
| row i | q(.16 + .07i, .36), rises 10px |
| output + verdict | q(.6, .34) |
| footnote | q(.68, .3) |
| legend | q(.72, .28) |

`visibility: hidden` while p ≤ .001 (nothing focusable unseen).

## Fitting the height

Heights are checked at 1512×861, 1280×650, 1024×768 (tablet), 390×664, 375×553.

| query | drops |
|---|---|
| desktop, max-height 800px | legend |
| desktop, max-height 680px | footnote |
| tablet, max-height 900px | legend |
| tablet, max-height 800px | footnote |
| phone | legend (always) |
| phone, max-height 640px | footnote |
| phone, max-height 590px | the Safe and Nonce rows |

## Reduced motion

Transforms off; opacity still follows the scroll.
