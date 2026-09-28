# Proof (section 3, "It caught Bybit")

Reference: `lib/sections/Collaboration.svelte`, `COLLABORATION_UI_TIMING` (ours:
`PROOF_TIMING`, with `phone` at ≤766). Screenshot: `reference-proof-collaboration.jpg`.

Files: `src/components/sections/Proof.tsx` + `Proof.module.css`; the record panel is
`src/components/proof/RecordPanel.tsx` (see `proof-record.spec.md`).
Copy: `PROOF` (heading, cta, ctaHref, statement, record, severities, exitCodes).

## Anatomy

```
.proof  (--scrim-opacity)            flex column, height 100%, relative
  .top                               relative, z 2 (above the mobile scrim)
    .wrap                            max-width 24rem | 26rem ≤1024 | 34rem ≥2245
      .headingWrap (translateY)      Heading h2, inverted, mobile-padded, lines nowrap
      IconPlus                       top 0, left 0, desktopHide
      .cta (not phone)               Button PROOF.cta → PROOF.ctaHref, cursor "Proceed"
    RecordPanel                      (ADDED) under the CTA
  .footer                            absolute, bottom 0, full width, z 1
    p.statement                      RevealText of PROOF.statement
    .cta (phone only)
```

The CTA is rendered twice, as on the reference: under the heading on desktop and tablet,
and in the bottom group with the statement on phones. Only one is displayed.

The footer is anchored to the bottom (the reference lets it fill the remaining height
with the statement pushed down by an auto margin). Same picture when everything fits;
when the added record panel makes the top group tall, the statement stays on screen
instead of being pushed past the bottom edge.

## Layout

| | desktop (≥1025) | tablet (767–1024) | phone (≤767) |
|---|---|---|---|
| padding-top | `--offset-content-top` (4.6rem) | 4.5rem | 4.75rem |
| wrap gap | 1.6rem | 1.6rem | 1.6rem |
| statement | bottom-right, `margin-left: auto`, padding-bottom 3.5rem | bottom-left, padding-bottom 3.5rem | bottom, above the CTA, padding 0 |
| footer | — | — | gap 1.5rem |

Wrap max-width is 24rem, not 21rem: "IT CAUGHT" at 72px Plex Mono is ~376px and the
reference's wrap is exactly its heading's width, so the CTA spans the heading.

### Statement

Display type (Plex Mono 500, uppercase, `--display-tracking`), `max-width: 24.5em`
(the reference's 22em in the narrower face, same physical measure), relative, z 1.

| width | size / line-height |
|---|---|
| ≥1025 | 1.35rem / 1.333 (reference text-2xl × .9) |
| ≥2245 | 2.7rem / 1 (text-5xl × .9) |
| ≤1024 | 16.2px / .95 (reference 18px × .9), mono word spacing |

(The reference's 776/628/450/420 steps are overridden by its own later ≤1024 rule, so
they never apply; only the effective sizes are kept.)

Desktop colour: `color-mix(in srgb, var(--grey-400) 60%, var(--grey-100))` (≈ the
reference #3c3f46); highlight (`{ highlight: true }` segment) `var(--ink)`, inline-block.
Container shadow: `drop-shadow(0 2px 4px rgb(4 7 13/.26)) drop-shadow(0 8px 20px rgb(4 7 13/.2))`.

≤1024: no filter; text `var(--text)`, highlight `var(--ink)`, on a dark readability scrim:
`::before`, full bleed (`left: calc(-1 * var(--offset-x-phone))`, `width: 100vw`), top
-7rem, bottom -100vh, z -1, `linear-gradient(180deg, transparent 0, var(--ground) 6rem)`,
opacity `var(--scrim-opacity)`, `will-change: opacity`. (The reference's light #eeedec
scrim becomes the page ground so it sits on black.)

## Behaviour (pure function of progress)

```
t        = phone ? PROOF_TIMING.phone : mobile ? .mobile : .desktop
ui       = uiProgress(progress, t.window)       // raw progress: the holdover exit, on
                                                 // every layout (no shader input here)
scrim    = beatProgress(clamp01(progress), t.beats.scrimIn)
           × (1 − beatProgress(progress, t.beats.scrimOut))
heading  = beatProgress(ui, t.beats.heading)     → Heading progress, t.headingMotion
subtitle = beatProgress(ui, t.beats.subtitle)    → RevealText, duration t.subtitleDuration,
                                                   progressPower 1.12
button   = beatProgress(ui, t.beats.button)
record   = beatProgress(ui, button beat shifted +.06)   → RecordPanel
```

- Heading wrapper: `translate3d(0, (1 − heading)·20px, 0)`.
- CTA wrapper: `clip-path: inset(0 (1−button)·100% 0 0)`, opacity button,
  `scaleX(button)`, origin left; hidden (visibility) at 0 so it cannot take focus unseen.
- IconPlus hidden: mobile ? heading < SUPPORTING_UI_REVEAL : ui ≤ .001.

## Reduced motion

Heading, RevealText and IconPlus handle their own; the CTA and the record panel keep their
opacity but drop transforms and clip.
