# Menu

Reference: `lib/components/Menu.svelte`, `lib/components/Socials.svelte`,
`lib/utils/animations/helpers/animationTimeline.ts`. Screenshot: `reference-menu-open.jpg`.

## Overview

A white panel that drops from the top-right corner (full screen on phones). Three coloured
sheets (accent, dark, white) lag behind the panel edge by a few frames, so its bottom edge flickers
accent → dark → white as it lands. Six section links, a full-width accent CTA, a hairline, a note,
and square social tiles. Opens from the `menuOpen` store.

## DOM

```
div#site-menu.menu[role=dialog][aria-modal][aria-label][aria-hidden][inert]   fixed, z 1000
  div.panel.first (accent) | div.panel.second (dark) | div.panel (white)      [data-menu-sheet]
  button.close[aria-label]  svg X
  div.wrap
    nav.nav
      a.link[href=#section-i] ×6
        span.inner [data-menu-item]
          span.arrow (accent pill, dark arrow)
          span.pill [data-pill] > span.fillWrap > span.fill | span.label > span.text
    div.cta > <Button variant="accent" label={MENU.contact}>
    div.rule
    div.note > p {MENU.note}
    div.socials > a.social ×SOCIALS  (bg, fillWrap > fill, icon)
```

## Values (desktop)

| Part | Value |
|---|---|
| Panel | `top 0; right 0; width 23.4rem`; height auto; `overflow hidden`; rest `translate3d(0,-104%,0)` |
| Wrap | `padding 1.2rem` |
| Nav | `margin -1.2rem -1.2rem 0; padding 1.2rem 5.2rem 0 1.2rem` |
| Link | display font, uppercase, `1.125rem × .9`; colour `--bg-primary`; `position relative; right 18px`; row pitch 38px (as rendered in the screenshot) |
| Pill | `--pill 1.7em; --pad-x .9em; --gap .3em`; `min-height var(--pill)`; `padding-inline var(--pad-x)`; radius 999 |
| Close | `top/right .6rem; padding .75rem`; icon 1.5rem, colour `--dark` |
| CTA | `margin-top 1.5rem; width 100%; height 3rem`; 4px white bar over its left edge |
| Rule | `1px #ccc; margin 3.6rem 0 .2rem; scaleX(0)` origin left |
| Note | `padding-top .8rem; margin 0 0 2rem`; p: Plex Sans 500, 15px, lh 120%, `max-width 85%` |
| Socials | `gap .5rem`; tile `3.5rem` square, radius .25rem, bg `--grey-400` at 10%, icon 1.25rem `--ground` |

Checked against the screenshot: first item centred at y≈37, CTA 271–319, rule ≈372, tiles 454–510,
panel bottom ≈526.

## Hover (fine pointer; also `:focus-visible`)

- Link `right: 18px → 9px` (`--motion-duration-base`, standard ease).
- Pill `padding-left → pad-x + pill + gap` (735ms `cubic-bezier(.625,.05,0,1)`), text `#fff`.
- Pill fill `--grey-400` circle grows from the pointer entry point (min `300% + 1rem`), 720ms same ease;
  on leave it shrinks toward the exit point.
- Arrow pill: `opacity 0 → 1` (.42s ease), `scale(.82) translateX(-.18em) → scale(1)` (735ms); arrow
  glyph `rotate(0 → -45deg)` (points down-right at rest, right on hover).
- Close: colour `--accent`, icon `rotate(90deg)`.
- Social: `--grey-400` circle fill (min `220% + 1rem`), icon white.

## Open / close sequence (ms from open; `start + stagger × i`)

| Target | From | Dur | Start | Stagger | Ease |
|---|---|---|---|---|---|
| Panel | `translateY(-104%)` | 860 | 0 | | outQuart |
| Sheets ×3 | `translateY(-1.4rem)` | 680 | 0 | 36 | outQuart |
| Close | `translateY(-1rem) rotate(-45deg) scale(.82)`, opacity 0 | 560 | 110 | | outQuart |
| Items ×6 | `translateY(115%) rotate(2deg)`, opacity .2 | 620 | 150 | 44 | customReveal |
| CTA | `translateY(1rem) scale(.985)`, opacity 0 | 520 | 390 | | outQuart |
| Rule | `scaleX(0)` | 460 | 450 | | `cubic-bezier(.25,.46,.45,.94)` |
| Note | `translateY(.8rem)`, opacity 0 | 480 | 480 | | outQuart |
| Socials | `translateY(.7rem) scale(.94)`, opacity 0 | 420 | 520 | 28 | outQuart |

Close plays the same clock backwards at 1.25× speed; when reversing from fully open every track
switches to `power2In` (`cubic-bezier(.64,0,.78,0)`). Per-frame step capped at 50ms.
Reduced motion: jump straight to open/closed.

## Behaviour

- Open → focus the close button; remember the element that had focus.
- Close (X, Escape, click outside, link, CTA) → `menuOpen=false`; focus returns to the remembered
  element, else the visible `[aria-controls=site-menu]` trigger (only if focus is not already elsewhere).
- Tab / Shift+Tab wrap inside the panel. Navigation keys inside the panel do not reach the stage.
- Link / CTA: `navigateToSection(i)` (smoke transition + `goToSection`) and close together.
- `menuPhase`: `open` → `closing` → `closed` on reverse complete (the header re-shows the phone trigger).

## Phone (≤767)

Panel `inset 0; 100vw × 100dvh`. Wrap: flex column, `padding 5.5rem .75rem .75rem`, scrolls.
Nav `gap 1rem; margin -1.25rem -1rem 0; padding 1.25rem 2.5rem 0 1rem`. Link `24px × .9`,
`line-height .9`, `padding .1rem 0`, pill `min-height 0`. CTA `margin-top auto` (sits at the bottom).
Rule `margin 1rem 0 .4rem`. Note `margin 0 0 1.5rem`, p full width. Tiles `3.7rem`, icon 1rem.
Close `top/right .5rem; padding .6rem`.

## Content

Items `SECTIONS.slice(1, 7)` → `indicatorLabel`, targets `section.index`. CTA `MENU.contact` → Contact.
Note `MENU.note`. Tiles from `SOCIALS` (GitHub: a drawn repository/branch glyph).
