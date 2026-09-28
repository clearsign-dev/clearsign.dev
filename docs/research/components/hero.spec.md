# Hero (section 0, "Opening")

Reference: `lib/sections/Hero.svelte`, `HERO_UI_TIMING` and `HERO_INTRO_PHASE(_MOBILE)` in
`lib/config/revealTiming.ts`, and the way `routes/+page.svelte` feeds it `introPhase` and
`isMobileIntro`. Screenshots: `reference-hero.jpg`, `reference-awwwards-hero.jpg`.

Files: `src/components/sections/Hero.tsx`, `Hero.module.css`.
Copy: `HERO` from `src/lib/content.ts`.

## Anatomy

```
.hero                      flex column, 100% x 100%, justify-content: end
  .meta (position: relative)   flex, space-between, align-items: end
    .group.leading         (hidden below 1024px)
      p  HERO.metaPrimary       primary beat, wraps at 27ch
      p  HERO.metaSecondary     secondary beat
    .group
      p  HERO.metaTertiary      primary beat
      p.clock (flex, gap 0.5rem)
        span.time  HH:MM UTC, weight 500, block reveal (split: false)
        span       HERO.clockLabel
    span.rule              the hairline, absolute at the bottom of .meta
  h1 (Heading as="h1")     HERO.heading, three lines
  IconPlus (right)         top 43%, right 20px
  IconPlus (left)          top 65%, left 20px
```

The icons are not inside the heading (our `Heading` takes no children). Neither `.hero`
nor its wrappers are positioned, so the icons resolve against the stage section, which is
what the reference does (its h1 is unpositioned; the `.section` is the containing block).

## Layout

| | desktop (≥1024) | not-desktop (≤1024) | phone (≤767) |
|---|---|---|---|
| `.hero` | `justify-content: end` | `space-between`, `padding-top: 15rem` | `padding-top: 12.5rem` |
| `.meta` | `margin-bottom: 2rem`, `padding-bottom: .5rem` | + `height: 100%` | |
| `.group` | `width: 35%` | `width: 100%` | |
| leading group | shown (`flex`) | `display: none` | |

Both groups: `display: flex; justify-content: space-between; align-items: end`.
Paragraphs inside `.meta`: `max-width: 27ch`.

Meta type (Plex Mono, `word-spacing: var(--word-spacing-mono)` declared on the row so the em
recomputes at each step), colour `var(--text)`:

| width | font-size | line-height |
|---|---|---|
| base | 15px | inherited (19.2px) |
| ≥768 | 1rem | 1.5 |
| ≥1181 | 1.125rem | 1.5556 |
| ≥2245 | 1.5rem | 1.3333 |

Hairline: `position: absolute; bottom: 0; left: 50%; width: 100%; height: 1px;
background: var(--hairline); transform-origin: center;` transform
`translate3d(-50%,0,0) scaleX(s)`.

### Headline

`line-height: 90%`, `margin: 0` (override Heading's -4px). Line 1 `margin-left: -5px`; lines
2 and 3 `margin-left: auto; margin-right: -5px` (right-aligned).

Sizes: the reference's steps x 0.9 for Plex Mono, expressed against `--h1-size` (180px):

| width | reference | ClearSign |
|---|---|---|
| >1600 | 200px | `var(--h1-size)` = 180px |
| ≤1600 | 178px | x0.89 = 160.2px |
| ≤1450 | 154px | x0.77 = 138.6px |
| ≤1240 | 128px | x0.64 = 115.2px |
| ≤1055 | 96px | x0.48 = 86.4px |
| ≤700 | 72px | x0.36 = 64.8px |
| ≤530 | 48px | x0.24 = 43.2px |

Every step is `min(step, fit)`, where
`fit = (100vw - 2 * side padding) / (longest line chars * 0.6)`. Plex Mono advances 0.6em per
glyph (0.58em with -0.02em tracking), so the longest line ("ABOUT TO SIGN", 13) can never
exceed the row. The longest-line length is computed from `HERO.heading` and passed as a CSS
variable. In practice the cap only acts below ~356px wide.

### Plus markers (reference overrides, applied with `!important` over the inline vars)

| max-width | right icon | left icon |
|---|---|---|
| — | top 43%, right 20px | top 65%, left 20px |
| 1600 | top 48% | |
| 1450 | 55% | 70% |
| 1240 | 62% | 75% |
| 1055 | 70% | 83% |
| 1024 | 65%, right 10px | 77%, left 10px |
| 767 (phone vars) | 65% | 77%, left 10px |
| 700 | 72% | 80% |
| 530 | 72% | 85% |

## Behaviour

Two modes, keyed off the global `canScroll` store (never local state, so a remounted hero
resumes scrubbing instead of replaying the intro).

**Play mode** (`canScroll` false). Phase set = `HERO_INTRO_PHASE_MOBILE` when
`isMobileTiming`, else `HERO_INTRO_PHASE`. Each part plays forward in real time when
`introPhase` reaches its phase:

- primary beat (`metaPrimary`, `metaTertiary`): `phase >= primaryText`
- secondary beat (`metaSecondary`, time, clock label): `phase >= secondaryText`
- headline: `phase >= heading`, `HERO_TIMING.headingMotion` (0.76s, 0.014s stagger)
- texts use `HERO_TIMING.textDuration` (0.58s)
- hairline: at `primaryText`, WAAPI `scaleX 0 → 1`, 1050ms, `EASE.power2Out`, fill both;
  scaleX 0 before that
- headline `onBeforeEnd = { offset: 0.16, callback: canScroll.set(true) }`
- plus markers hidden

**Scrub mode** (`canScroll` true). With `p = clamp01(progress)`:

```
ui = p <= 0.54 ? 1 : 1 - smoothstep((p - 0.54) / 0.46)
secondary = beatProgress(ui, scrollBeats.secondaryText)   // 0.12 → 1.00
heading   = beatProgress(ui, scrollBeats.heading)         // 0.05 → 1.00
```

- primary texts: `progress = ui`, power 1.25
- secondary texts and time: `progress = secondary`, power 1.25
- headline: `progress = heading ** 1.12`
- hairline: `scaleX(ui)`
- markers hidden when `ui <= 0.001` (desktop) or `heading < SUPPORTING_UI_REVEAL` (mobile)

## Clock

UTC `HH:MM`, bold (500), then `HERO.clockLabel`. A small module store refreshed every 10s
by an effect; `--:--` until the first client tick so the static HTML never carries a stale
build-time time.

## Reduced motion

Heading and RevealText degrade themselves. The hairline animation runs with 0ms duration
(jumps to its end state). IconPlus stops spinning.
