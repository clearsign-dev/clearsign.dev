# Reads (section 2, "What it reads")

Reference: `lib/sections/Services.svelte`, `SERVICES_UI_TIMING` (ours: `READS_TIMING`).
Screenshot: `reference-reads-services.jpg`.

Files: `src/components/sections/Reads.tsx` + `Reads.module.css`,
`src/components/reads/ReadsHotspots.tsx` (desktop, see `reads-hotspot.spec.md`),
`src/components/reads/ReadsCards.tsx` (mobile).
Copy: `READS` (heading, sup, hotspotHint, two groups of title/summary/items).

## Anatomy

```
<section> (stage, positioned: the containing block for the hotspot layer)
  .reads                 flex 1 1 0, relative, container (inline-size)
    Heading h2           READS.heading, position bottom, sup "2", mobile-padded
    IconPlus             bottom 1.2rem, left [-1.68rem, 0], desktopHide
    ReadsCards           ≤1024 only
  ReadsHotspots          ≥1025 only; absolute inset 0 over the whole section
```

## Layout

| | desktop (≥1025) | ≤1024 |
|---|---|---|
| `.reads` | `margin-left: var(--offset-content)` (right half) | full width |
| hotspots | two, centred at (14%, 50%) and (86%, 50%) of the section | hidden |
| cards | hidden | horizontal snap scroller above the heading |

The breakpoint is 1025, not 1024: the stage switches to mobile timing at ≤1024, and the
reference's Services margin starts at 1025, so layout and choreography switch together.

### Heading size ("H2 Large")

"WHAT IT READS" is 13 glyphs against "SERVICES"' 8, so each step is capped by a fit term
(Plex Mono advances 0.6em; `chars` = longest line, passed as `--reads-longest-line`):

| width | size |
|---|---|
| ≥1025 | `min(var(--h2-large-size), (100cqi + 4px) / (chars * 0.6))` |
| 551–1024 | `min(var(--h2-large-size) * 96/104, (100cqi - 1.68rem + 4px) / (chars * 0.6))` |
| ≤550 | Heading's own clamp, unchanged |

The line never wraps (`white-space: nowrap` on the line).

## Cards (≤1024)

```
.cards  absolute, left 0, width 100%, flex row, gap .625rem, padding-inline .625rem,
        padding-bottom = overflow allowance (56px), overflow-x auto, snap x mandatory,
        scrollbar hidden, bottom = title-space + 1.5rem - allowance
  .card  per group: title (h3) + items (ul, 3px dot bullets)
```

- title-space: 3rem at ≤550; above, the heading's line box + .35rem
  (`size * 0.9 + 0.35rem`, the reference's 5.75rem at its 96px).
- Card: 50% wide; at ≤768 `calc(100% - 4.625rem)`, max 21.25rem. Padding
  .75rem .75rem 1.25rem, radius .75rem, background
  `linear-gradient(145deg, rgb(255 255 255 / .065), transparent 42%), var(--grey-600)`,
  `box-shadow: inset 0 0 0 1px rgb(255 255 255 / .045)`, gap 8.5px, origin 50% 100%.
- Title 15px #fff, mono word spacing. List 12px/1.5 `--grey-500`, 0.85rem indent.
- Scroller is focusable (arrow keys scroll it), `role="region"` named by the two card
  titles (`aria-labelledby`), so no new copy.

## Behaviour (pure function of progress)

```
t      = isMobileTiming ? READS_TIMING.mobile : READS_TIMING.desktop
ui     = uiProgress(clamp01(progress), t.window)
head   = beatProgress(ui, t.beats.heading)          → Heading progress, t.headingMotion
card_i = beatProgress(ui, t.beats.cards[i])         → hotspot i (desktop) / card i (mobile)
icon hidden: mobile ? head < SUPPORTING_UI_REVEAL : ui <= 0.001
```

Card i (mobile), `layer(p, s, span) = smoothstep((p - s) / span)`:

| part | value |
|---|---|
| card opacity | layer(p, 0, .72) |
| card transform | `perspective(900px) translate3d(0, (1-p)·52px, 0) rotateX((1-p)·6deg) scale(.965 + p·.035)` |
| title | opacity layer(p, .08, .7), rises 14px |
| list | opacity layer(p, .2, .72), rises 18px |
| scroller pointer-events | `auto` once card 0 > .24 |

## Reduced motion

Cards, titles and lists drop their transforms (opacity still follows scroll). Heading and
IconPlus handle their own.
