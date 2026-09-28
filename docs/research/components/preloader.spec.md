# Preloader: shell, sequence, counter, exit

Reference: `lib/components/Preloader/index.svelte`, `LoadingLabel.svelte`,
`lib/utils/animations/progress.ts`, the `showPreloader` / `loadingProgress`
flags in `lib/store.svelte.ts`. Screenshot: `reference-preloader-cta.jpg`.

Files: `src/components/chrome/Preloader/Preloader.tsx` (entry, exports
`Preloader`), `Preloader.module.css`, `WaitingMessage.tsx`, `LoadingLabel.tsx`,
`loadTarget.ts`, `progress.ts`, `inertOthers.ts`. The grid is in
`preloader-pattern.spec.md`; the circles and the gate in `preloader-gate.spec.md`.

## Mounting

- Renders nothing unless `preloader.visible` (starts true; `?preloader=off`
  sets it false). The overlay is a child component so its state starts fresh.
- Server render includes the overlay, so the page never flashes before it.

## Shell

- `position: fixed; inset: 0`, **z-index 10000**, `overflow: hidden`, ground
  black, `word-spacing: normal`. `role="dialog"`, `aria-modal`, labelled by
  `PRELOADER.loadingLabel` while loading and by the gate title once it shows.
- Takes every pointer event; siblings up the tree get `inert` while it is up
  (restored when leaving starts; custom elements and `data-inert-exempt`, i.e.
  the landscape overlay, are skipped). The shell takes focus on mount; Tab is
  trapped: it lands on START or nowhere.
- Easing curves are passed in as custom properties from `EASE`.

## Mount reveal

| Element | From | Duration | Delay | Ease |
|---|---|---|---|---|
| grid, circles | opacity 0, y 18px, scale .985, blur 12px | 1.4s | .05s | customReveal |
| counter pill | opacity 0, y 16px, blur 8px | .68s | .28s | customReveal |

## Progress

- Target = `preloader.progress` (reported by the scene). Nothing reported
  (progress 0, not ready) after **1.5s** → a synthetic target joins in:
  `92·(1 − e^(−t/3.5s))`, and the larger of the two wins. Not ready after
  **10s** → treated as ready (no WebGL). Neither is written to the store.
- The displayed value moves toward `min(target, 99)` (or 100 once ready) at
  **≤ 30 units/s**, with frame time clamped to 1/30s so a stalled thread never
  jumps it. It never goes down. The grid engine owns this value (worker or main
  thread) and reports each integer change; the counter, message unlocks and the
  gate all read that one value.

## Counter pill ("N ◆ Loading")

- Absolute, bottom/left 1.25rem, z 2. Flex, centred, gap 1rem, padding
  .375rem 1rem, radius .25rem, 14px mono, `--grey-300` on `--grey-400` at 95%,
  0.5px border `--grey-300` at 30%. A 4px square rotated 45° between number and
  label. `role="progressbar"` with `aria-valuenow`.
- ≤1024: bottom/left 12px, gap 10px, padding .28rem .7rem, .72rem.
- Leaving: opacity → 0, y → −10px, .32s power1.inOut.

## Waiting messages

- `PRELOADER.messages`, centred (`top/left 50%`, translate −50%), z 1, width
  `min(90vw, 720px)`, 0 20px padding, uppercase, 500, tracking .18em,
  `clamp(.74rem, 1.6vw, 1rem)`, `--grey-300` at 55%, shadow `0 8px 24px` black 42%.
  ≤1400: `min(92vw, 620px)`, .14em, `clamp(.72rem, 1.3vw, .92rem)`.
  ≤1024: `min(90vw, 520px)`, 0 16px, .12em.
- Per-character reveal (masked): from `translateY(100%) rotateX(−85°) scale(.96)`,
  opacity 0, blur 8px (desktop only) → rest. .42s each, .006s stagger, power3.out,
  both ×1.18 on touch/narrow. Hide: the reverse at 2× speed, last char first.
- Unlocked index from the displayed value: <25 → 0, <75 → 1, else the last.
- Phases: revealing → (reveal done) holding → (120ms) visible → hiding when a
  later message is unlocked, or at 100 on the last one → (hide done) next index
  revealing, or, at 100 on the last, the sequence is complete.
- Every message shows at least once, even when loading is instant.
- Screen readers get the whole line from a persistent, visually hidden
  polite live region in the shell; the animated letters are `aria-hidden`.

## Gate hand-off

Sequence complete → the circles and the gate mount (gate not yet ready). 600ms
later (50ms reduced) the gate is ready: it reveals and START takes focus.

## START (click, or Enter anywhere while the gate is ready)

Inside the handler, in order: `soundOn.set(true)`, `playSfx("click")`,
`preloader.leaving = true`. Idempotent. Enter on the focused button is left to
the native click.

## Exit

| Element | To | Duration | Ease |
|---|---|---|---|
| shell | opacity 0, blur 6px; pointer-events none | 1.15s | power1.inOut |
| counter | opacity 0, y −10px | .32s | power1.inOut |
| gate, circles | see gate spec | .45–1.1s | customReveal |

On the shell's `animationend` (fallback timer +300ms): `preloader.visible =
false`, `introStarted.set(true)`. `leaving` stays true (START was pressed).

## Reduced motion

No grid animation, no pointer trail, no letter motion: messages, gate and
circles fade (.25–.3s); exit is a .3s fade. The counter still counts.
