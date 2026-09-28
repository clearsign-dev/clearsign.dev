# StepCard (+ CopyCommand)

Reference anatomy: `lib/components/ForestCard.svelte`. Data: one entry of
`GET_IT.steps` (`title`, `body`, optional `action`, optional `command`).

Files: `src/components/getit/StepCard.tsx` + `StepCard.module.css`,
`src/components/getit/CopyCommand.tsx` + `CopyCommand.module.css`.

## DOM

```
div.card  (--edge-progress)              surface layer; ::before is the edge
  div.header
    div.title                            title layer
    div.index  aria-hidden               index layer: "01", "02", "03"
  div.desc                               description layer
    p.body
    Button (action)  |  CopyCommand (command)
```

The whole card reads as a group labelled by its title (set on the slot).

## Reveal layers (props: `revealProgress`, `timing` = `GET_IT_TIMING.*.cardItems`)

Each layer is `beatProgress(revealProgress, beat)`. Values at or past 0.999
drop their transform to `none`.

| layer | opacity | transform while revealing |
|---|---|---|
| surface | `s` | `perspective(900px) translate3d(0, (1 − s) × 38px, 0) rotateX((1 − s) × 6°) scale(0.975 + 0.025 s)` |
| edge | — | `--edge-progress: e` (a 1px top rule draws in from the left) |
| index | `i` | `translate3d((1 − i) × 12px, 0, 0)` |
| title | `t` | `translate3d(0, (1 − t) × 14px, 0)` |
| description | `d` | `translate3d(0, (1 − d) × 18px, 0)`; the body text sits at 0.8 opacity |

Reduced motion: everything at rest (no transforms), the body at its resting
opacity.

## Style

`--grey-600` surface, `border-radius: 0.75rem`, `contain: layout style paint`,
`transform-origin: center bottom`.

| | ≤ 1024 | desktop |
|---|---|---|
| padding | `0.75rem 0.75rem 1.25rem` | `1rem 1.25rem 1.5rem` |
| gap | 0.5rem | 1rem |
| header | mono `0.9375rem/1.2` | `1.125rem` |
| body | sans `0.8125rem/1.35` | `1rem/1.3` |

Title `--ink`, mono, `--word-spacing-mono`. Index `--grey-300`, tabular.
Body `--grey-300`, `--font-sans`, normal word spacing. Edge: 1px rule from
`rgb(var(--accent-rgb) / 0.55)` fading to transparent, `scaleX(e)` from the left.

## Body text and the command

`GET_IT.steps[1].body` opens with its own command. When a step has a `command`
and its `body` starts with it, the command is shown once, as the code line, and
the rest of the body (leading punctuation trimmed) as the paragraph. Nothing is
reworded.

## Action

`Button` (`ui/Button`, variant `dark`, `showIcon`), `href = action.href`; the
Button opens external links in a new tab. Label `action.label`.

## CopyCommand

- `code.selectable` in `--font-mono`, `word-spacing: normal`, wraps at spaces
  (never overflows a narrow card), on a faint `--ink` 4% well with a hairline.
- Icon button, `aria-label="Copy command"`, 2rem square, two overlapping
  rounded squares; after a copy it shows a check in `--accent` for 1.6s and a
  polite live region announces "Copied".
- Copy: `navigator.clipboard.writeText`; if that is unavailable or refused,
  select the code's text and fall back to `document.execCommand("copy")`, so
  at worst the command is left selected for the visitor to copy.
- Hover plays the `hover` sfx; a copy plays `click`.
