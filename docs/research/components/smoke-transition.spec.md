# Smoke transition

Reference: `lib/utils/fullScreenSmokeTransition.ts`, `lib/hooks/useScrollToSection.ts`.

## What the reference does

`runFullScreenSmokeTransition(task)`:

1. If one is already running, return without running the task.
2. `stage = covering`, wait one frame, animate progress 0 → 1 over **520ms** with **easeOutQuint**
   (`1 - (1 - t)^5`).
3. Settle 0ms, run the task (the stage starts its animated jump: 0.9–1.8s, not awaited).
4. `stage = revealing`, wait one frame, animate 1 → 0 over **640ms** with **easeInOutCubic**.
5. `stage = idle`. Errors from the task are rethrown after the reveal.

Reduced motion: 140ms / 160ms. The menu links, the menu CTA, the logo and the header CTA all go
through it; the tick indicator does not. The reference's repo only keeps the progress store (its
renderer lived in the WebGL scene), so the look below is ours, keeping the timing and shape of
the curve.

## Our look

A procedural fog front that crosses the screen diagonally from the bottom-left to the top-right,
covers everything, and then leaves the same way (the trailing edge follows the front out, so it
reads as a bank of smoke passing through rather than a fade).

- Canvas 2D, low resolution (~26k pixels at the viewport's aspect), CSS-scaled to full screen, so
  bilinear upscaling softens it. No textures.
- Density: value-noise fBm with one level of domain warp, drifting along the sweep over time; each
  run gets a random seed so no two sweeps look the same.
- Sweep coordinate `s = .62·u + .38·(1 − v)`; the edge billows by `clamp((n − .5) · 2.6, ±1) · .22`.
- Cover: front `f = lerp(−reach, 1 + reach, p)`, `alpha = smooth(f − s − disp)` over ±.1.
  Reveal: trailing edge `t = lerp(−reach, 1 + reach, 1 − p)`, `alpha = smooth(s + disp − t)`.
  `reach` includes the haze so p = 0 is fully clear and p = 1 fully covered.
- A thin haze runs .3 ahead of the dense front (up to .55 alpha). About 2ms a frame for ~26k pixels.
- Colour: body between `--ground`, `--dark` and `--grey-400` by density; the front's edge picks up
  `--grey-100` mist and a faint `--accent-rgb` glow. Colours are read from the CSS tokens at run time.
- Reduced motion (or no canvas): a flat `--ground` veil fades in and out on the same clock.

## API

```ts
runSmokeTransition(onCovered: () => void): Promise<void>
isSmokeTransitionRunning(): boolean
smokeTransitionState  // store: { active, stage: "idle" | "covering" | "revealing" }
<SmokeTransitionLayer />  // mounted once; fixed, inset 0, z 1100, aria-hidden
```

- No layer mounted → `onCovered` runs at once and the promise resolves.
- While active the layer takes pointer events, so clicks cannot land on half-hidden UI.
- `navigateToSection(i)` (in `chrome/header/navigate.ts`) = skip when `!canScroll`, else
  `runSmokeTransition(() => goToSection(i))`.
