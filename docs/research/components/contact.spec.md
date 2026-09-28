# Contact section

Reference: `lib/sections/Contact.svelte`, `lib/components/ContactForm.svelte`,
`CONTACT_UI_TIMING` (ported as `CONTACT_TIMING`). Screenshot: `reference-contact.jpg`.

## Overview

The last stage section. A dark panel rises from the bottom edge of the viewport:
heading and lead on the left with the credit line and socials pinned to its
bottom; the form on the right (two fields, then the message, then a full-width
accent submit) with a footer row under it. Everything reveals bottom-to-top as
the section scrolls in.

## DOM

```
div.contact                       height 100%, flex, align-items: flex-end
  div.panel                       opacity/translate/scale from panelShow
    div.content                   grid: minmax(16rem,50%) minmax(22rem,1fr)
      div.intro                   flex column, space-between, min-height 100%
        div
          div.headingWrap         opacity + translateY(24px)
            Heading h2            CONTACT.heading, per-char scrub
          p.lead                  CONTACT.lead, opacity + translateY(28px)
        div.leftMeta
          a.credit                CONTACT.credit (block reveal, 32px)
          div.socials             SocialLinks compact, opacity + translateY(40px)
      div.right
        form.form (ContactForm)
          div.row > div.cell ×2   name, email
          div.cell                message
          div.submit              accent Button (clip reveal) + status note
        footer.footer             licence (72px) | privacy link (80px)
```

## Values

- `.contact`: `padding-top: var(--offset-content-top); width: 100%; height: 100%`; ≥2245px `max-width: 90vw`.
- Panel: `border: .5px solid grey-300/30%; background: rgba(8,9,14,.76); padding: 1.3rem 1.5rem 1rem;
  border-radius: .25rem; transform-origin: bottom center`.
- Content gap 1.4rem, `align-items: start`. Intro gap 1rem. Right: flex column gap 1rem.
- Heading: 3.6rem × .9 = 3.24rem, line-height .9 (lines .88), margin 0, solid
  `var(--heading-fill)` glyphs (no background-clip: avoids a Chromium raster bug under promoted layers).
  ≤1330px `clamp(2.88rem, 6.66vw, 4.95rem)`.
- Lead: sans, `var(--grey-300)`, .9rem, line-height 1.35, margin-top 1rem, max-width 50ch.
- Left meta: flex column, gap .75rem, .92rem. Credit: `var(--grey-100)`, padding .25em, hover white; name in white.
- Footer: margin-top .25rem; `var(--grey-100)`; space-between; gap 1.5rem; .92rem; nowrap. Link inherits, hover white .25s.
- Form: column gap 1rem; row gap 1rem, no wrap; cells `calc((100% - 1rem)/2)`, gap .25rem.

## Choreography (scroll-scrubbed)

With `p = clamp01(progress)` and the table picked by `isContactStacked` (≤1255px):

- `clock = clamp01(p / revealWindow)`, `panel = clamp01(p / panelRevealEnd)`.
- Each beat: `slice = linearBeatProgress(clock, beat)`; `show = easeOutCubic(slice)`
  (`easeOutQuart` for submit).
- Panel: opacity show, `translate3d(0, (1-show)×18px, 0) scale(lerp(.955, 1, show))`.
- Heading: Heading `progress = slice` with `headingMotion`; wrapper opacity show, y (1-show)×24.
- Lead y ×28; socials y ×40; name/email cells y ×24; message y ×28.
- Submit: opacity show, `clip-path: inset(0 (1-show)×100% 0 0)` (wipes in left to right).
- Credit / footer: block reveal: `e = 1-(1-slice^1.25)^4`; opacity e,
  translateY (1-e)×offset (32 / 72 / 80px); hidden at 0.
- Desktop order: heading, name, email, lead, message, submit, credit, socials, footer ×2.
  Stacked order: heading, lead, credit, socials, name, email, message, submit, footer ×2.

## Form behaviour

- Fields from `CONTACT.fields`; name and email required (as the reference), message optional.
- Validation on submit (native constraint validation, `noValidate` form): required
  (a blank name counts as missing) and email format (`type=email` plus a pattern
  requiring a dot-TLD). Messages: `CONTACT.errors.required`, `CONTACT.errors.email`.
  The first invalid field takes focus. After an error, the field re-validates as it is edited.
- Send button: accent, cursor label `CONTACT.submitCursor`.
- Valid submit: `mailto:CONTACT_EMAIL?subject=ClearSign: what it missed&body=Name…Email…message`
  assigned to `window.location.href`; `CONTACT.sentNote` appears under the button in a
  polite live region. Editing any field hides it. Nothing is posted anywhere.

## Responsive

- ≤1255px: padding-top 5.7rem; panel padding 1rem 1rem .85rem; one column, gap 1rem;
  heading `clamp(2.61rem, 9vw, 4.725rem)`; intro gap .85rem; left meta margin-top .25rem.
- ≤1024px: form row wraps; tablet cells `calc(50% - .5rem)`.
- ≤767px: padding-top 3.3rem; panel .75rem; heading `clamp(2.25rem, 10.8vw, 3.6rem)`;
  footer .72rem, normal word spacing, gap .45rem; form gaps .625rem; cells 100%.
- ≥2245px: padding-top 5.8rem; panel 1.8rem 2rem 1.4rem, radius .35rem; columns
  `minmax(22rem,1fr) minmax(42rem,64rem)`, gap 1.75rem; heading `clamp(5.58rem, 6.3vw, 8.55rem)`;
  footer margin-top 1.25rem, 1.12rem; form gaps 1.5rem.

## Content mapping

GET IN TOUCH → `CONTACT.heading`; lead → `CONTACT.lead`; Alias/Email/Message →
`CONTACT.fields`; Submit → `CONTACT.submit`; "Website by Lynksen" → `CONTACT.credit`;
socials → `SOCIALS`; "© 2026…" → `CONTACT.licence`; "Privacy Policy" → `CONTACT.privacy` (`/privacy`).
