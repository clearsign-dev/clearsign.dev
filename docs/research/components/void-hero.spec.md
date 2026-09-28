# Void Hero → "Byte Hero": the hidden rhythm game

The 404 page mounts `VoidHero({ open, onClose })` and opens it on the Konami code.
Same structure, rules and feel as the reference game; ClearSign's colour, type
and words. Notes are bytes falling toward a signing line. Everything is original
code; all sound is synthesised.

## Screens (phases)

| Phase | What shows |
|---|---|
| `ready` | Highway revealed (preview, no notes). HUD top-left: mark + title, mute `M`, hearts, mixer (track tiles + volume). Giant score `0` behind the lanes. CTA at 72% height: **Start**, hint `Enter / Space`, key legend. Close top-right (`Esc`). Idle hint after 5 s still. |
| `playing` | Lanes, falling bytes, pads with key labels (`D/1 F/2 J/3 K/4`, pointer-fine only). HUD adds stage name + progress bar, score, combo, pause `P`. Exit panel bottom-left: "Leave the run?" **End run**. Combo popups. Keys hint if the player never presses while bytes go blind. |
| `playing` + paused | Audio clock suspended, so everything freezes. Panel: **Resume**, **End run**. Auto-pauses on window blur / tab hidden. |
| `ended` | Highway dims. Results top-right: score, stage, read, blind, best combo, best score, best stage, "New best". CTA: **Retry**, **Exit**. Phone: results become a bottom sheet with the mixer and the two buttons. |
| `ended` by hearts | "DO NOT SIGN" styling in `--sev-critical`: stamp in the results, the giant text reads DO NOT SIGN, the signing line turns red, live bytes turn BLIND. Ending with **End run** is a plain "Run complete". |

Retry goes straight back to `playing` (as the reference's Restart). Exit and `Esc` close the modal.

## Input

- Lanes 0–3: `D F J K` and `1 2 3 4`. Pointer/touch: lane from the x position at the pointer's depth on the perspective highway. Holds follow the same source (key code / pointer id) on release.
- `Enter`/`Space` start (ready) or retry (ended) when focus is not on another control. `M` mute, `P` pause, `Esc` exit. Focus is trapped in the dialog and returned on close; after Start focus moves to the dialog so Space cannot press a button.
- Blur / context menu / pause drop active holds without penalty and clear pressed lanes.

## Timing (audio clock is the only clock)

- `now = AudioContext.currentTime − output latency`, smoothed between audio ticks, never decreasing. Suspended context = frozen clock = pause.
- Every sequencer step has an absolute time `t0 + i·step (+ swing on odd 16ths)`. A note's hit time **is** its step time, so every note lands on a played beat. Notes spawn when `hitTime ≤ now + travel`; screen depth is `z = (hitTime − now) / travel`.
- Travel (far edge → line): 2.6 s ÷ `speedMul`.
- Good window: `0.18 s × max(0.684, windowScale) ÷ speedMul`, floor 70 ms (the reference's distance window, expressed in time; it shrinks as notes speed up). Perfect: inside 28% of the good window.
- Presses are back-dated by the event's `timeStamp` delay.

## Judgement and scoring

| Event | Effect |
|---|---|
| Perfect / Nice (tap) | combo +1, score + 2 / 1 × stage multiplier (rounded, ≥ 1); byte is **read** (accent flash, hex sparks) |
| Hold head hit | as above, then +1× every 0.16 s held; release within 0.1 s of the end or reach the end = **Complete** +5× |
| Released early | −1 heart, combo 0, tail turns BLIND |
| No note within the window | **Early**: combo 0, pad flashes critical, no heart lost |
| Note passes the window | **BLIND** byte (dim, `--sev-blind`, keeps falling and fades), −1 heart, combo 0 |
| Every 25 combo | +1 heart (max 3), popup |
| 0 hearts | run over, DO NOT SIGN |

Popups: first hit "Perfect"/"Nice"; combo ≥ 2 "x{n}"; milestones 10, 25, 50 and every 100 show "{n} READ" large with a milestone chime every 10. Best score and best stage persist in `localStorage` for every ended run.

## Progression (1 step = 1 beat at the spawn horizon, counted from the first spawn)

| Stage | From step | speed× | window× | score× | density | chords / holds |
|---|---|---|---|---|---|---|
| Nibble | 0 | 1.00 | 1.00 | 1.00 | 0.18 | no / no |
| Byte | 56 | 1.10 | 0.94 | 1.20 | 0.34 | yes / yes |
| Word | 120 | 1.22 | 0.85 | 1.50 | 0.50 | yes / yes |
| Block | 216 | 1.36 | 0.76 | 1.85 | 0.66 | yes / yes |
| Chain | 344 | 1.50 | 0.70 | 2.25 | 0.78 | yes / yes |

After Chain, every 256 steps is "Chain II, III…": axes ease toward 1.85 / 0.62 / 0.86 over 4 sub-stages; score +0.3 each. The first 16 steps of each stage ease speed, window and score from the previous stage (smoothstep). The first 16 steps of a run cap density at 0.12. A stage change fires a banner popup, shake and chime. Faster tracks climb faster because steps are beats.

## Charts from the sequencer

Each track's steps are data (drums, bass, lead, pad per 16th). The chart is derived once per track from the loop section:

- Salience per step = metric weight (bar 0.35, half 0.25, beat 0.18, 8th 0.08) + kick 0.28 + snare/clap 0.24 + lead 0.26 + bass 0.12, × velocity, plus a tiny deterministic jitter. Hats alone make no note.
- Hold = lead note ≥ 4 steps or bass note ≥ 6 steps, if ≥ 0.45 s; starts at least 6 beats apart; from Byte on.
- Density gate: salience threshold that admits `density × 110` notes per minute of the loop (the reference's rate).
- Chords: on beats where a drum hit meets a lead note, a partner byte two lanes away, only for bytes inside the strongest 25% (a second gate at `density × 0.25`) and once chords unlock.
- Lanes follow the melodic contour of the bytes that actually spawn: up moves right, down moves left, a leap (≥ 9 semitones) moves two, a repeated pitch steps aside, edges bounce; drum-only bytes sit left (kick) or right (snare). Pitch bands put every downbeat in one lane, so they were dropped.
- Lane conflicts: a lane is busy until its last note (or hold end) + max(0.16 s, 1.5 steps); the note moves to the nearest free lane or is dropped.
- Two intro bars never carry notes; switching track mid-run starts the new track at its loop, drops bytes in flight without penalty and keeps the stage.

## Tracks (names ours)

| Track | BPM | Level | Mood / sound |
|---|---|---|---|
| Cold Storage | 84 | Easy | Swung dub: sparse kick, rim, soft hats, sine+triangle bass with long roots, triangle arpeggio through a dotted delay, saw pad. A minor. |
| Mempool | 108 | Medium | Straight drive: four-on-the-floor, 16th hats, saw octave bass, square lead motif then 16th arpeggios. D minor. |
| Gas War | 136 | Hard | Electro break: broken kick, clap, ghost snares, resonant acid saw bass, detuned saw stabs and fast arps. E phrygian. |

Level from tempo like the reference (< 95 Easy, < 115 Medium, else Hard); tiles show the track's first bar as a dot grid plus 1–3 level bars.

## Audio

Master → compressor → out. Music bus = volume; SFX bus = 0.5 × volume; mute zeroes both (the silent track still drives the clock). Lookahead scheduler (25 ms tick, 120 ms ahead) on a per-run bus that fades on stop. Voices: kick (sine pitch drop), snare/clap/rim/hats (noise through filters), bass (osc → resonant low-pass with envelope), lead (osc pair → low-pass → dry + delay send), pad (detuned saws). SFX: intro rise, perfect/nice ticks, early click, blind drop, heart thump, milestone chord, stage arpeggio, run-over two-tone. Choosing a tile in ready/ended previews the track; Start restarts it from bar 1 in sync with the chart. Volume, mute and track persist.

## Feel (canvas 2D perspective highway)

Staggered reveal on open (lanes, then separators, then pads, 1.15 s). Beat and bar lines scroll with the music. Kick pulses brighten lanes and separators. Pads: press squeeze, approach glow, charge while held (accent), critical flash on Early, core fill while holding, pop on Perfect. Hits: expanding ring, beam up the lane, hex-digit sparks; perfect with combo ≥ 6 adds a small bolt; milestones a big bolt, impact ring and brief flash. Shake: perfect 1, nice 0.5, blind 0.2, heart 0.35, stage 1.4, complete 1.2; decays fast.

**Reduced motion:** no shake, no flash, no bolts, popups fade without floating, hearts change without animation, reveal is instant. Gameplay unchanged.

## Deviations from the reference

- 2D canvas perspective instead of WebGL scene; the modal dims the 404 page instead of flying the 404 camera.
- No free-running "no music" mode: the mute tile silences the synth but keeps its clock and chart.
- Holds need stage 2 (Byte) in chart mode, matching when the pattern bank introduces them.
- Pause exists (the audio clock makes it exact); quitting records best score too.
