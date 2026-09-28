# Audio engine

Files: `src/lib/audio/engine.ts`, `src/components/chrome/AudioEngine.tsx`.

## What the reference does

- One looping music file plus four one-shot files (click, clickAlt, hover,
  transition) played through Howler. Relative levels: music 0.7, click 0.25,
  hover 0.25, transition 0.25, clickAlt 0.1.
- Howler is muted from the preloader's mount. The gate's START either unmutes
  (and tells the visualiser to start the loop) or stays muted.
- The visualiser taps Howler's master gain with an analyser (fftSize 2048).
- Mute/unmute ramps the master volume over 350ms (ease-out quad).
- A body click listener plays `clickAlt` when the target is inside a `button`
  or `a`, `click` otherwise. Section step changes play `transition`, but not
  while a transition is still sounding.
- Preferences in localStorage: "enter with sound" (`'1'`/`'0'`, default on)
  and a master volume 0..1, both wrapped in try/catch.

## What ClearSign does instead

No files at all. Everything is synthesised with Web Audio, lazily, on the
first user gesture. Different sounds, same roles and relative loudness.

### Graph

```
bed voices ─┐
            ├─ breath (slow swell) ─ bedTone (lowpass) ─┐
noise bed ──┘ (bandpass, own gain) ─────────────────────┼─ bedFade ─┐
                                                        │           ├─ bus ─ limiter ─ master ─ analyser ─ out
sfx one-shots ──────────────────────────────────────────────────────┘
```

- `master` = user volume × 0.85, smoothed (τ 20ms) so a volume drag never zips.
- `limiter`: DynamicsCompressor, threshold −20dB, knee 10, ratio 14,
  attack 4ms, release 220ms. Catches stacked clicks over the bed.
- `analyser`: fftSize 2048, sits after master so the visualiser shows what is
  actually heard (bed and one-shots), like the reference.
- SFX skip the bed's lowpass so clicks stay crisp.

### Bed ("a low drone")

| voice | wave | pitch | level | pan | detune LFO |
|---|---|---|---|---|---|
| root | triangle | A1 55Hz | 0.075 | −0.3 | 0.05Hz ±5c |
| shadow | sine | A1 −7c | 0.05 | +0.3 | 0.061Hz ±6c |
| fifth | sine | E2 82.41Hz | 0.04 | 0 | 0.071Hz ±8c |
| air | stereo white noise | bandpass 380Hz Q0.8, centre swept ±140Hz at 0.037Hz | 0.02 | decorrelated L/R | — |

- Root and shadow beat against each other (~0.13Hz) and are panned apart, so
  the beat drifts slowly across the stereo field: the width is gentle.
- `breath`: one gain the voices share, swung ±18% by a 0.033Hz sine.
- `bedTone`: lowpass 780Hz, Q 0.4. Keeps the triangle's upper harmonics soft.
- Peak sum before the limiter ≈ 0.2 (about −14dBFS). Quiet on purpose.

### Fades

- `bedFade` moves with `setTargetAtTime(target, now, 0.3)`: ~98% of the way in
  1.2s, both directions. The current value is held first so a toggle mid-fade
  turns around smoothly.
- When sound goes off (or the tab is hidden), the context is suspended 1.5s
  later if it is still off, so an idle page costs no audio CPU.

### One-shots (only while sound is on and the context is running)

All envelopes are exponential; nodes are disconnected when the source ends.
A context started inside a gesture reports `suspended` for a few ms; one-shots
fired within 250ms of that start are still scheduled (the preloader calls
`playSfx("click")` right after `soundOn.set(true)`), later ones are dropped.

- **hover** — soft tick. Sine 1850→1250Hz over 30ms; peak 0.028, attack 2ms,
  decay 40ms. Rate-limited to one per 45ms.
- **click** — crisp. White-noise burst → highpass 1800Hz → bandpass 3600Hz Q0.9,
  peak 0.16, attack 0.8ms, decay 22ms; plus a sine body 1400→700Hz, peak 0.05,
  decay 30ms. One per 30ms.
- **clickAlt** — lower and a touch longer, for buttons and links. Triangle
  420→210Hz over 70ms, peak 0.065, decay 90ms; plus noise → bandpass 1500Hz
  Q1.4, peak 0.06, decay 35ms. One per 30ms.
- **transition** — soft whoosh, 0.6s. Stereo noise → bandpass Q1.1 swept
  280→1900Hz (0.32s) → 600Hz (0.6s) → lowpass 3200Hz → panner −0.45→+0.45;
  gain rises linearly to 0.05 at 0.26s, decays to silence at 0.62s. Ignored
  while a previous whoosh is still sounding (the reference's `isPlaying` guard).

### Starting only after a gesture

- `soundOn` is a synchronous store. `AudioEngine` subscribes to it directly
  (not through a React effect), so `soundOn.set(true)` inside the preloader's
  START click or the pill's click creates and resumes the context inside that
  same gesture — what Safari requires.
- `unlockAudio()` (called on the pill's pointerdown) creates/resumes the
  context without making sound, so a volume drag can switch sound on from
  `pointermove`. It suspends again after 1.5s if nothing turned sound on.
- A capture-phase `pointerdown`/`keydown` listener resumes a context that is
  wanted but not running (autoplay block, iOS interruption, tab restore).
- The saved preference is never used to start audio on its own.

## API (`engine.ts`)

- `getAnalyser(): AnalyserNode | null`
- `setSoundEnabled(on)`, `unlockAudio()`, `resumeIfWanted()`, `setAudioHidden(hidden)`
- `playEngineSfx(key: SfxKey)`
- `soundVolume` store (0..1, starts at 1 so SSR and hydration agree),
  `setVolume(level, { persist })`, `restoreVolume()`
- `readSoundPreference(fallback = true)`, `saveSoundPreference(on)` —
  `clearsign:sound` = `'1'`/`'0'`; volume in `clearsign:volume`.
- `disposeAudio()` closes the context.

## `AudioEngine` (renders nothing, mounted once)

On mount: restore the saved volume; `registerSfxPlayer(playEngineSfx)`;
subscribe to `soundOn` (apply + save the preference on every change); body
click listener (`clickAlt` inside `button, a`, `click` elsewhere); gesture
resume listeners; `visibilitychange` → `setAudioHidden`. On unmount: undo all
of it, `registerSfxPlayer(null)`, close the context.
