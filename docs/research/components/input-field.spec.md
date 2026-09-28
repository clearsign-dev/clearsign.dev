# InputField

Reference: `lib/components/InputField.svelte`, phone overrides in `ContactForm.svelte`.
Screenshot: `reference-contact.jpg` (Alias, Email, Message boxes).

## Overview

A glassy field box: a small label sitting above the value, the placeholder in
light grey when empty. The box lifts 1px and brightens on hover, gets a sheen
and a pale ring on focus, and leans slightly toward the pointer.

## DOM

```
div.field[data-filled][data-error]  (data-cta-active, data-cta-pressed)
  ::before  sheen (120° gradient, slides in)
  ::after   pointer glow
  label.label[for]
  input.input  (aria-invalid, aria-describedby)
p.error#<id>-error   (only with an error message; sibling after the box)
```

## Values

- Box: `min-height: 3.5rem; padding: .375rem 1rem; gap: .25rem; border-radius: 4px;
  border: 1px solid grey-300/30%; background: linear-gradient(180deg, rgba(255,255,255,.03), transparent), rgb(43 44 48 / 80%);
  backdrop-filter: blur(5px); overflow: hidden`, flex column centred.
- Shadow: `inset 0 1px 0 rgba(255,255,255,.04), 0 10px 24px rgba(0,0,0,0)`.
- Transform: `perspective(900px) translate3d(shiftX×.55, lift + shiftY×.55, 0) rotateX rotateY scale`.
- Transitions: border-color, background 220ms `cubic-bezier(.22,1,.36,1)`; box-shadow, transform 420ms `cubic-bezier(.16,1,.3,1)`.
- Label: 0.875rem, line-height 1, grey-300/50%, mono word spacing; color/transform/opacity 220ms.
- Input: transparent, white, no border/outline, `var(--text-base)` mono;
  `translate3d(shift×.08, …)`; placeholder `var(--grey-300)`.
- Sheen `::before`: inset −1px; 120° gradient (0 → white .14 @28% → rgb(193 202 222/.18) @55% → 0);
  opacity 0, `translateX(-22%) scale(.98)`.
- Glow `::after`: inset −18%; radial 18rem rgb(193 202 222) glow×1.2 → ×.28 @22% → 0 @62%; opacity glow×2.2.

## States

| State | Trigger | Changes |
|---|---|---|
| hover | fine pointer over box | lift −1px; border grey-300/44%; bg overlay .05 on rgba(43,44,48,.88); shadow `0 10px 24px rgba(0,0,0,.14)`; sheen .72 at −8%; label white/.78; input +1px |
| focus | `:focus-within` | lift −1px; border rgb(193 202 222/.55); bg overlay .07 on .92; ring `0 0 0 1px rgb(193 202 222/.2)` + `0 14px 30px rgba(0,0,0,.18)` + `0 10px 24px rgb(193 202 222/.1)`; sheen 1 at 0; label white/.9 raised 1px; input +1px |
| filled | value not empty | label grey-300/70% (ours; the reference has no filled style) |
| error | `error` or `hasError` | border `--sev-critical`/55%; label and value `--sev-critical`; focus ring /.24 + /.12 glow; message below |

Resonance: `maxShift 4.5, maxRotate 1.4, maxGlow .14`; pointer press scales .982;
typing Space does not (the reference's key press pulse is skipped in fields).

Error message: `--sev-critical`, 0.75rem, mono word spacing, margin-left .25rem;
≥2245px 1rem, margin-left .35rem. Validation errors are a status, so they use the
severity red rather than the accent (BRAND.md allows this for form validation).

## Responsive

- phone ≤767: padding .6rem .8rem.
- small-phone ≤390: padding .4rem .6rem; input .8rem.
- Contact phone overrides (applied by the Contact through `className`): gap .18rem,
  padding .48rem .75rem, min-height 2.95rem, label .72rem, input .9rem / 1.2;
  small-phone padding .42rem .65rem, min-height 2.75rem, label .68rem, input .84rem.

## Reduced motion

No transitions, no transforms.
