# Textarea

Reference: `lib/components/Textarea.svelte` (not used by the reference's contact
form, which uses a single-line field for the message; ported for completeness).

## Overview

The multi-line sibling of InputField: same glass box, sheen, glow, hover and
focus treatment; the label on top and a non-resizable textarea filling the rest.

## DOM

```
div.field[data-filled][data-error]
  ::before sheen, ::after glow
  label.label[for]
  textarea.textarea (aria-invalid, aria-describedby)
p.error#<id>-error (optional)
```

## Values

- Box: `color: var(--grey-300); padding: .8rem 1rem; gap: .5rem; height: 13.68rem;
  border-radius: 4px; border: 1px solid grey-300/30%`; same background, backdrop blur,
  shadow, transform and transitions as InputField; flex column.
- Label: 0.75rem, grey-300/50%, margin-bottom .1rem, mono word spacing.
- Textarea: `resize: none; flex: 1 1 auto`; transparent, white, mono; placeholder grey-300.
- Sheen: as InputField but the 28% stop is white .12.
- Resonance: `maxShift 4.5, maxRotate 1.3, maxGlow .14`.

## States

Hover, focus, filled and error exactly as InputField.

## Responsive

- phone ≤767: padding .6rem .8rem; gap .25rem; height 7.5rem.
- small-phone ≤390: height 6rem; scrollbar hidden.

## Reduced motion

No transitions, no transforms.
