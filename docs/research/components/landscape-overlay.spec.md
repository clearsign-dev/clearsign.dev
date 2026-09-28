# Landscape overlay

Reference: `lib/components/LandscapeOverlay.svelte`.

Files: `src/components/chrome/LandscapeOverlay.tsx` (exports
`LandscapeOverlay`), `LandscapeOverlay.module.css`.

## When it shows

Only on a touch device held sideways; never on a desktop with a narrow window.

- Touch = `(pointer: coarse)` matches (live, so leaving devtools device
  emulation clears it). Where that query is unsupported, fall back to the
  user agent.
- Landscape = `screen.orientation.type` starts with `landscape`; else
  `(orientation: landscape)`; else `innerWidth > innerHeight`.
- Re-evaluated on orientation change, the orientation media query, the
  pointer media query and `resize`.
- Server render: hidden.

## Look

| | |
|---|---|
| layer | fixed, inset 0, **z-index 10002** (above the preloader at 10000 and the cursor at 9989–9991), padding 2rem |
| backdrop | `--dark` at 97%, `backdrop-filter: blur(8px)`; swallows every tap |
| layout | column, centred, gap 1rem, max-width 22rem, centred text |
| icon | 64px phone outline (1.4 stroke, round caps), accent. Rocks from −90° to 0°: held at −90° to 15%, eased to 0° by 55%, held; 2.4s ease-in-out, infinite |
| line | ink, 1.05rem, 500, tracking .08em, uppercase |

- Fades in and out over 280ms (instant under reduced motion). While hidden it
  is `visibility: hidden`, so it is out of the accessibility tree and the icon
  does not animate.
- `role="alertdialog"`, `aria-modal`, labelled by its line.

## Copy

The reference has a title and a sentence. Neither is in `content.ts`, so this
shows one functional line of our own: "Rotate your device".

## Reduced motion

No rocking (icon upright), no fade.
