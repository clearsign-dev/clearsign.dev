import { createStore } from "@/lib/stage/store";
import type { SfxKey } from "./sfx";

// ClearSign's sound, synthesised in the browser with Web Audio. Nothing is
// downloaded. The context is created lazily, and only ever from inside a user
// gesture (see AudioEngine), so no browser has to block it.
//
// Graph:
//   drone voices → breath → bedTone ─┐
//   noise bed ──────────────────────┴→ bedFade ─┐
//   one-shots ──────────────────────────────────┴→ bus → limiter → master → analyser → out
//
// See docs/research/components/audio-engine.spec.md for the patch and levels.

const PREF_KEY = "clearsign:sound";
const VOLUME_KEY = "clearsign:volume";

const FADE_SECONDS = 1.2;
// setTargetAtTime gets ~98% of the way after four time constants.
const FADE_TIME_CONSTANT = FADE_SECONDS / 4;
const SUSPEND_AFTER_MS = FADE_SECONDS * 1000 + 300;
// Headroom under the user's volume: the loudest the whole site ever gets.
const MASTER_TRIM = 0.85;
const VOLUME_SMOOTHING = 0.02;
const SILENT = 0.0001;
// A context created or resumed inside a gesture reports "suspended" for a few
// milliseconds. One-shots fired in that window (the preloader's START click)
// are still scheduled; any later ones wait for a running context.
const STARTING_GRACE_MS = 250;

const MIN_GAP: Record<SfxKey, number> = {
  hover: 0.045,
  click: 0.03,
  clickAlt: 0.03,
  transition: 0,
};

type Graph = {
  ctx: AudioContext;
  master: GainNode;
  analyser: AnalyserNode;
  bus: GainNode;
  bedFade: GainNode;
  noise: AudioBuffer;
  transitionUntil: number;
  lastPlayed: Record<SfxKey, number>;
};

let graph: Graph | null = null;
let wantOn = false;
let hidden = false;
let suspendTimer: ReturnType<typeof setTimeout> | null = null;
let stopVolumeSync: (() => void) | null = null;
let startedAt = -Infinity;

/** Master volume 0..1. Starts at 1 on server and client; AudioEngine restores the saved level after mount. */
export const soundVolume = createStore(1);

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ---------------------------------------------------------------- storage

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable (private browsing, quota, blocked site data).
  }
}

/** The visitor's last choice. Used to preset the preloader's toggle; it never starts audio by itself. */
export function readSoundPreference(fallback = true): boolean {
  const raw = readStorage(PREF_KEY);
  return raw === null ? fallback : raw === "1";
}

export function saveSoundPreference(on: boolean) {
  writeStorage(PREF_KEY, on ? "1" : "0");
}

function readVolume(fallback: number): number {
  const raw = readStorage(VOLUME_KEY);
  if (raw === null) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? clamp01(parsed) : fallback;
}

/** Puts the saved volume into `soundVolume`. Call after mount. */
export function restoreVolume() {
  soundVolume.set(readVolume(1));
}

export function setVolume(level: number, options?: { persist?: boolean }) {
  const next = clamp01(level);
  soundVolume.set(next);
  if (options?.persist) writeStorage(VOLUME_KEY, next.toFixed(3));
}

// ---------------------------------------------------------------- graph

function createContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor({ latencyHint: "interactive" });
  } catch {
    return null;
  }
}

function makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
  // Independent channels, so anything fed from this buffer is decorrelated L/R.
  for (let ch = 0; ch < 2; ch += 1) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function lfo(ctx: AudioContext, rate: number, depth: number, target: AudioParam, start: number) {
  const osc = ctx.createOscillator();
  osc.frequency.value = rate;
  const amount = ctx.createGain();
  amount.gain.value = depth;
  osc.connect(amount).connect(target);
  osc.start(start);
}

type Voice = { type: OscillatorType; hz: number; cents: number; level: number; pan: number; lfoHz: number; lfoCents: number };

const DRONE: Voice[] = [
  // Root and its shadow beat slowly against each other from opposite sides.
  { type: "triangle", hz: 55, cents: 0, level: 0.075, pan: -0.3, lfoHz: 0.05, lfoCents: 5 },
  { type: "sine", hz: 55, cents: -7, level: 0.05, pan: 0.3, lfoHz: 0.061, lfoCents: 6 },
  { type: "sine", hz: 82.41, cents: 0, level: 0.04, pan: 0, lfoHz: 0.071, lfoCents: 8 },
];

function buildBed(ctx: AudioContext, noise: AudioBuffer, out: AudioNode) {
  const t = ctx.currentTime;

  const bedTone = ctx.createBiquadFilter();
  bedTone.type = "lowpass";
  bedTone.frequency.value = 780;
  bedTone.Q.value = 0.4;
  bedTone.connect(out);

  const breath = ctx.createGain();
  breath.gain.value = 1;
  breath.connect(bedTone);
  lfo(ctx, 0.033, 0.18, breath.gain, t);

  for (const v of DRONE) {
    const osc = ctx.createOscillator();
    osc.type = v.type;
    osc.frequency.value = v.hz;
    osc.detune.value = v.cents;
    lfo(ctx, v.lfoHz, v.lfoCents, osc.detune, t);
    const level = ctx.createGain();
    level.gain.value = v.level;
    const pan = ctx.createStereoPanner();
    pan.pan.value = v.pan;
    osc.connect(level).connect(pan).connect(breath);
    osc.start(t);
  }

  // A thin band of air under the drone.
  const air = ctx.createBufferSource();
  air.buffer = noise;
  air.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 380;
  band.Q.value = 0.8;
  lfo(ctx, 0.037, 140, band.frequency, t);
  const airLevel = ctx.createGain();
  airLevel.gain.value = 0.02;
  air.connect(band).connect(airLevel).connect(out);
  air.start(t);
}

function ensureGraph(): Graph | null {
  if (graph) return graph;
  const ctx = createContext();
  if (!ctx) return null;

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.6;
  analyser.connect(ctx.destination);

  const master = ctx.createGain();
  master.gain.value = soundVolume.get() * MASTER_TRIM;
  master.connect(analyser);

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -20;
  limiter.knee.value = 10;
  limiter.ratio.value = 14;
  limiter.attack.value = 0.004;
  limiter.release.value = 0.22;
  limiter.connect(master);

  const bus = ctx.createGain();
  bus.connect(limiter);

  const bedFade = ctx.createGain();
  bedFade.gain.value = 0;
  bedFade.connect(bus);

  const noise = makeNoise(ctx, 3);
  buildBed(ctx, noise, bedFade);

  graph = {
    ctx,
    master,
    analyser,
    bus,
    bedFade,
    noise,
    transitionUntil: 0,
    lastPlayed: { hover: -1, click: -1, clickAlt: -1, transition: -1 },
  };

  stopVolumeSync = soundVolume.subscribe(() => {
    if (!graph) return;
    const now = graph.ctx.currentTime;
    graph.master.gain.cancelScheduledValues(now);
    graph.master.gain.setTargetAtTime(soundVolume.get() * MASTER_TRIM, now, VOLUME_SMOOTHING);
  });

  return graph;
}

function glide(param: AudioParam, target: number, ctx: AudioContext) {
  const now = ctx.currentTime;
  const current = param.value;
  param.cancelScheduledValues(now);
  param.setValueAtTime(current, now);
  param.setTargetAtTime(target, now, FADE_TIME_CONSTANT);
}

function clearSuspend() {
  if (suspendTimer !== null) {
    clearTimeout(suspendTimer);
    suspendTimer = null;
  }
}

function scheduleSuspend() {
  clearSuspend();
  suspendTimer = setTimeout(() => {
    suspendTimer = null;
    if (graph && (!wantOn || hidden) && graph.ctx.state === "running") {
      graph.ctx.suspend().catch(() => {});
    }
  }, SUSPEND_AFTER_MS);
}

function resume(g: Graph) {
  if (g.ctx.state === "running") return;
  startedAt = performance.now();
  g.ctx.resume().catch(() => {});
}

function canPlay(g: Graph) {
  const { state } = g.ctx;
  return state === "running" || (state === "suspended" && performance.now() - startedAt < STARTING_GRACE_MS);
}

// ---------------------------------------------------------------- control

export function getAnalyser(): AnalyserNode | null {
  return graph?.analyser ?? null;
}

/** Fade the drone in or out. Call from inside a user gesture when turning on. */
export function setSoundEnabled(on: boolean) {
  wantOn = on;
  if (on) {
    const g = ensureGraph();
    if (!g) return;
    clearSuspend();
    resume(g);
    if (!hidden) glide(g.bedFade.gain, 1, g.ctx);
    return;
  }
  if (!graph) return;
  glide(graph.bedFade.gain, 0, graph.ctx);
  scheduleSuspend();
}

/** Create and resume the context inside a gesture without making any sound. */
export function unlockAudio() {
  const g = ensureGraph();
  if (!g) return;
  resume(g);
  if (!wantOn) scheduleSuspend();
}

/** Resume a context that is wanted but not running (blocked, interrupted, restored tab). */
export function resumeIfWanted() {
  if (graph && wantOn && !hidden) resume(graph);
}

/** Fade out while the tab is in the background; come back when it returns. */
export function setAudioHidden(isHidden: boolean) {
  hidden = isHidden;
  if (!graph) return;
  if (isHidden) {
    glide(graph.bedFade.gain, 0, graph.ctx);
    scheduleSuspend();
  } else if (wantOn) {
    clearSuspend();
    resume(graph);
    glide(graph.bedFade.gain, 1, graph.ctx);
  }
}

export function disposeAudio() {
  clearSuspend();
  stopVolumeSync?.();
  stopVolumeSync = null;
  wantOn = false;
  const g = graph;
  graph = null;
  g?.ctx.close().catch(() => {});
}

// ---------------------------------------------------------------- one-shots

type Env = { peak: number; attack: number; decay: number };

function envelope(ctx: AudioContext, t: number, { peak, attack, decay }: Env): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(SILENT, t);
  g.gain.exponentialRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(SILENT, t + attack + decay);
  return g;
}

function filter(ctx: AudioContext, type: BiquadFilterType, hz: number, q = 0.7): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  f.Q.value = q;
  return f;
}

/** Wire a chain, start the source, and tear the chain down when it ends. */
function fire(source: AudioScheduledSourceNode, chain: AudioNode[], out: AudioNode, t: number, length: number, offset = 0) {
  let node: AudioNode = source;
  for (const next of chain) node = node.connect(next);
  node.connect(out);
  source.onended = () => {
    source.disconnect();
    chain.forEach((n) => n.disconnect());
  };
  if (source instanceof AudioBufferSourceNode) source.start(t, offset);
  else source.start(t);
  source.stop(t + length);
}

function tone(g: Graph, t: number, type: OscillatorType, from: number, to: number, sweep: number, env: Env) {
  const osc = g.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + sweep);
  fire(osc, [envelope(g.ctx, t, env)], g.bus, t, env.attack + env.decay + 0.02);
}

function noiseBurst(g: Graph, t: number, filters: BiquadFilterNode[], env: Env) {
  const src = g.ctx.createBufferSource();
  src.buffer = g.noise;
  // Start somewhere different each time so repeated clicks are not identical.
  const offset = Math.random() * (g.noise.duration - 0.2);
  fire(src, [...filters, envelope(g.ctx, t, env)], g.bus, t, env.attack + env.decay + 0.02, offset);
}

function whoosh(g: Graph, t: number) {
  const { ctx } = g;
  const src = ctx.createBufferSource();
  src.buffer = g.noise;
  const band = filter(ctx, "bandpass", 280, 1.1);
  band.frequency.setValueAtTime(280, t);
  band.frequency.exponentialRampToValueAtTime(1900, t + 0.32);
  band.frequency.exponentialRampToValueAtTime(600, t + 0.6);
  const soften = filter(ctx, "lowpass", 3200);
  const pan = ctx.createStereoPanner();
  pan.pan.setValueAtTime(-0.45, t);
  pan.pan.linearRampToValueAtTime(0.45, t + 0.6);
  const level = ctx.createGain();
  level.gain.setValueAtTime(0, t);
  level.gain.linearRampToValueAtTime(0.05, t + 0.26);
  level.gain.exponentialRampToValueAtTime(SILENT, t + 0.62);
  fire(src, [band, soften, pan, level], g.bus, t, 0.66);
  g.transitionUntil = t + 0.62;
}

export function playEngineSfx(key: SfxKey) {
  const g = graph;
  if (!g || !wantOn || hidden || !canPlay(g)) return;
  const t = g.ctx.currentTime;
  if (t - g.lastPlayed[key] < MIN_GAP[key]) return;

  switch (key) {
    case "hover":
      tone(g, t, "sine", 1850, 1250, 0.03, { peak: 0.028, attack: 0.002, decay: 0.04 });
      break;
    case "click":
      noiseBurst(g, t, [filter(g.ctx, "highpass", 1800), filter(g.ctx, "bandpass", 3600, 0.9)], {
        peak: 0.16,
        attack: 0.0008,
        decay: 0.022,
      });
      tone(g, t, "sine", 1400, 700, 0.018, { peak: 0.05, attack: 0.001, decay: 0.03 });
      break;
    case "clickAlt":
      tone(g, t, "triangle", 420, 210, 0.07, { peak: 0.065, attack: 0.002, decay: 0.09 });
      noiseBurst(g, t, [filter(g.ctx, "bandpass", 1500, 1.4)], { peak: 0.06, attack: 0.001, decay: 0.035 });
      break;
    case "transition":
      if (t < g.transitionUntil) return;
      whoosh(g, t);
      break;
  }
  g.lastPlayed[key] = t;
}
