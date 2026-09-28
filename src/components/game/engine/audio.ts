// Everything audible in the game is synthesised here with Web Audio: the three
// tracks (drums from noise and oscillators, bass, lead, pad) and the game's
// sound effects. The AudioContext clock is also the game's only clock.

import { beatSeconds, stepAt, stepSeconds, stepTime, type Step, type Tone, type Track } from "./tracks";

export type SfxName =
  | "intro"
  | "perfect"
  | "nice"
  | "early"
  | "blind"
  | "heart"
  | "milestone"
  | "stage"
  | "complete"
  | "over";

const LOOKAHEAD_SEC = 0.12;
const TICK_MS = 25;
const START_LEAD_SEC = 0.12;
const SFX_SHARE = 0.5;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

interface Run {
  track: Track;
  t0: number;
  next: number;
  stopped: boolean;
  bus: GainNode | null;
  delayIn: GainNode | null;
  delayNodes: AudioNode[];
  /** Times (context clock) of scheduled kicks, for the visual pulse. */
  kicks: { time: number; vel: number }[];
}

type WebkitWindow = Window & { webkitAudioContext?: typeof AudioContext };

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private music: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private run: Run | null = null;
  private timer: number | null = null;
  private timeouts = new Set<number>();
  private destroyed = false;

  private volume: number;
  private muted: boolean;

  // Smoothed clock state.
  private latency = 0;
  private latencySampledAt = -Infinity;
  private lastRaw = -1;
  private lastPerf = 0;
  private lastEstimate = 0;

  // Stand-in clock when Web Audio is unavailable, so the game still runs.
  private fallbackOffset = 0;
  private fallbackPausedAt: number | null = null;

  constructor(volume: number, muted: boolean) {
    this.volume = volume;
    this.muted = muted;
  }

  /** Creates the context on first use. Call from a user gesture. */
  ensure(): boolean {
    if (this.ctx) return true;
    if (this.destroyed || typeof window === "undefined") return false;
    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctor) return false;
    try {
      const ctx = new Ctor({ latencyHint: "interactive" });
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 3.5;
      comp.attack.value = 0.003;
      comp.release.value = 0.18;
      comp.connect(ctx.destination);

      const music = ctx.createGain();
      const sfx = ctx.createGain();
      music.connect(comp);
      sfx.connect(comp);

      const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

      this.ctx = ctx;
      this.music = music;
      this.sfxBus = sfx;
      this.noise = noise;
      this.applyGains(true);
      this.timer = window.setInterval(this.pump, TICK_MS);
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  get hasContext(): boolean {
    return this.ctx !== null;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  resume(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === "suspended") return this.ctx.resume().catch(() => undefined);
      return Promise.resolve();
    }
    if (this.fallbackPausedAt !== null) {
      this.fallbackOffset += performance.now() / 1000 - this.fallbackPausedAt;
      this.fallbackPausedAt = null;
    }
    return Promise.resolve();
  }

  suspend(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === "running") return this.ctx.suspend().catch(() => undefined);
      return Promise.resolve();
    }
    if (this.fallbackPausedAt === null) this.fallbackPausedAt = performance.now() / 1000;
    return Promise.resolve();
  }

  /** Raw scheduling clock. */
  private raw(): number {
    if (this.ctx) return this.ctx.currentTime;
    const p = performance.now() / 1000;
    return (this.fallbackPausedAt ?? p) - this.fallbackOffset;
  }

  /**
   * The time being heard right now on the context clock: currentTime smoothed
   * between audio callbacks, minus output latency, never going backwards.
   */
  now(): number {
    const ctx = this.ctx;
    if (!ctx) return this.raw();
    const raw = ctx.currentTime;
    const perf = performance.now() / 1000;
    if (raw !== this.lastRaw) {
      this.lastRaw = raw;
      this.lastPerf = perf;
    }
    const estimate = ctx.state === "running" ? raw + Math.min(perf - this.lastPerf, 0.03) : raw;
    if (estimate > this.lastEstimate) this.lastEstimate = estimate;
    return this.lastEstimate - this.latency;
  }

  private sampleLatency() {
    const ctx = this.ctx;
    if (!ctx) return;
    const perf = performance.now();
    if (perf - this.latencySampledAt < 1000) return;
    const first = this.latencySampledAt === -Infinity;
    this.latencySampledAt = perf;
    const reported = ctx.outputLatency > 0 ? ctx.outputLatency : ctx.baseLatency || 0;
    const target = Math.max(0, Math.min(0.25, reported));
    this.latency = first ? target : this.latency + (target - this.latency) * 0.1;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.applyGains(false);
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyGains(false);
  }

  private applyGains(immediate: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.music || !this.sfxBus) return;
    const m = this.muted ? 0 : this.volume;
    const s = this.muted ? 0 : this.volume * SFX_SHARE;
    if (immediate) {
      this.music.gain.value = m;
      this.sfxBus.gain.value = s;
    } else {
      this.music.gain.setTargetAtTime(m, ctx.currentTime, 0.02);
      this.sfxBus.gain.setTargetAtTime(s, ctx.currentTime, 0.02);
    }
  }

  // -------------------------------------------------------------- sequencer

  /**
   * Starts `track` so that global step `startStep` sounds just after now.
   * Returns the run's step-0 time on the context clock.
   */
  startTrack(track: Track, startStep = 0): number {
    this.stopTrack(0.08);
    const t0 = this.raw() + START_LEAD_SEC - stepTime(track, 0, startStep);
    const run: Run = {
      track,
      t0,
      next: startStep,
      stopped: false,
      bus: null,
      delayIn: null,
      delayNodes: [],
      kicks: [],
    };

    const ctx = this.ctx;
    if (ctx && this.music) {
      const bus = ctx.createGain();
      bus.connect(this.music);
      const d = track.voicing.delay;
      const delayIn = ctx.createGain();
      delayIn.gain.value = d.mix;
      const delay = ctx.createDelay(2);
      delay.delayTime.value = Math.min(1.9, d.beats * beatSeconds(track));
      const feedback = ctx.createGain();
      feedback.gain.value = d.feedback;
      const tone = ctx.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = 2600;
      delayIn.connect(delay);
      delay.connect(tone);
      tone.connect(feedback);
      feedback.connect(delay);
      tone.connect(bus);
      run.bus = bus;
      run.delayIn = delayIn;
      run.delayNodes = [delayIn, delay, feedback, tone];
    }

    this.run = run;
    this.pump();
    return t0;
  }

  stopTrack(fadeSec = 0.3) {
    const run = this.run;
    if (!run) return;
    run.stopped = true;
    this.run = null;
    const ctx = this.ctx;
    if (!ctx || !run.bus) return;
    const now = ctx.currentTime;
    run.bus.gain.cancelScheduledValues(now);
    run.bus.gain.setValueAtTime(run.bus.gain.value, now);
    run.bus.gain.linearRampToValueAtTime(0, now + Math.max(0.01, fadeSec));
    const bus = run.bus;
    const nodes = run.delayNodes;
    this.later(() => {
      bus.disconnect();
      for (const n of nodes) n.disconnect();
    }, (fadeSec + 1.2) * 1000);
  }

  get trackPlaying(): boolean {
    return this.run !== null && !this.run.stopped;
  }

  /** Strongest kick heard since the last call (0 if none), for the beat pulse. */
  takeKick(heardTime: number): number {
    const run = this.run;
    if (!run) return 0;
    let vel = 0;
    while (run.kicks.length > 0 && run.kicks[0].time <= heardTime) {
      vel = Math.max(vel, run.kicks.shift()!.vel);
    }
    return vel;
  }

  /** Schedules every step that falls inside the lookahead window. */
  pump = () => {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== "running") return;
    this.sampleLatency();
    const run = this.run;
    if (!run || run.stopped) return;
    const horizon = ctx.currentTime + LOOKAHEAD_SEC;
    let guard = 64;
    while (guard-- > 0) {
      const t = stepTime(run.track, run.t0, run.next);
      if (t > horizon) break;
      // Steps that slipped into the past (a stalled tab) are skipped, not crammed.
      if (t >= ctx.currentTime - 0.03) this.playStep(run, stepAt(run.track, run.next), t);
      run.next++;
    }
  };

  private playStep(run: Run, st: Step, t: number) {
    const v = run.track.voicing;
    const sd = stepSeconds(run.track);
    if (st.kick) {
      this.kick(run, t, st.kick);
      if (st.kick >= 0.5) run.kicks.push({ time: t, vel: st.kick });
    }
    if (st.snare) this.snare(run, t, st.snare);
    if (st.clap) this.clap(run, t, st.clap);
    if (st.rim) this.rim(run, t, st.rim);
    if (st.hat) this.noiseHit(run.bus, t, 0.045, "highpass", v.hat.tone, 0.8, v.hat.level * st.hat);
    if (st.openHat) this.noiseHit(run.bus, t, 0.26, "highpass", v.hat.tone, 0.8, v.hat.level * 1.2 * st.openHat);
    if (st.bass) this.bass(run, t, st.bass, sd);
    if (st.lead) this.lead(run, t, st.lead, sd);
    if (st.pad && v.pad.level > 0) this.pad(run, t, st.pad.midis, st.pad.len * sd);
  }

  // -------------------------------------------------------------- voices

  private env(g: GainNode, t: number, peak: number, attack: number, end: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  }

  private noiseHit(
    dest: AudioNode | null,
    t: number,
    dur: number,
    type: BiquadFilterType,
    freq: number,
    q: number,
    level: number,
  ) {
    const ctx = this.ctx;
    if (!ctx || !dest || !this.noise || level <= 0) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    this.env(g, t, level, 0.002, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(dest);
    src.start(t, Math.random() * 0.5, dur + 0.05);
  }

  private tone(
    dest: AudioNode | null,
    t: number,
    type: OscillatorType,
    f0: number,
    f1: number,
    glide: number,
    peak: number,
    dur: number,
  ) {
    const ctx = this.ctx;
    if (!ctx || !dest || peak <= 0) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + glide);
    const g = ctx.createGain();
    this.env(g, t, peak, 0.004, t + dur);
    o.connect(g);
    g.connect(dest);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private kick(run: Run, t: number, vel: number) {
    const k = run.track.voicing.kick;
    this.tone(run.bus, t, "sine", k.from, k.to, 0.12, k.level * vel, k.decay);
    this.noiseHit(run.bus, t, 0.012, "highpass", 3200, 0.7, 0.18 * vel);
  }

  private snare(run: Run, t: number, vel: number) {
    const s = run.track.voicing.snare;
    this.noiseHit(run.bus, t, 0.17, "highpass", s.tone, 0.7, s.level * vel);
    this.tone(run.bus, t, "triangle", 195, 150, 0.07, s.level * 0.55 * vel, 0.09);
  }

  private clap(run: Run, t: number, vel: number) {
    const s = run.track.voicing.snare;
    for (let i = 0; i < 3; i++) {
      this.noiseHit(run.bus, t + i * 0.012, 0.03, "bandpass", 1100, 0.9, s.level * 0.8 * vel);
    }
    this.noiseHit(run.bus, t + 0.03, 0.16, "bandpass", 1100, 0.9, s.level * vel);
  }

  private rim(run: Run, t: number, vel: number) {
    const s = run.track.voicing.snare;
    this.tone(run.bus, t, "triangle", 820, 760, 0.02, s.level * 0.7 * vel, 0.05);
    this.noiseHit(run.bus, t, 0.022, "bandpass", 2600, 1.2, s.level * 0.6 * vel);
  }

  private bass(run: Run, t: number, note: Tone, sd: number) {
    const ctx = this.ctx;
    if (!ctx || !run.bus) return;
    const b = run.track.voicing.bass;
    const dur = Math.max(0.05, note.len * sd * b.gate);
    const peak = b.level * note.vel;

    const o = ctx.createOscillator();
    o.type = b.wave;
    o.frequency.value = hz(note.midi);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = b.q;
    const open = b.cutoff + b.envAmount * note.vel * (note.accent ? 1.4 : 1);
    filter.frequency.setValueAtTime(open, t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, b.cutoff), t + Math.min(dur, 0.25));
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.006);
    g.gain.setValueAtTime(peak, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.07);
    o.connect(filter);
    filter.connect(g);
    g.connect(run.bus);
    o.start(t);
    o.stop(t + dur + 0.1);

    if (b.sub > 0) {
      const sub = ctx.createOscillator();
      sub.type = "sine";
      sub.frequency.value = hz(note.midi - 12);
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.0001, t);
      sg.gain.exponentialRampToValueAtTime(peak * b.sub, t + 0.01);
      sg.gain.setValueAtTime(peak * b.sub, t + dur);
      sg.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
      sub.connect(sg);
      sg.connect(run.bus);
      sub.start(t);
      sub.stop(t + dur + 0.1);
    }
  }

  private lead(run: Run, t: number, note: Tone, sd: number) {
    const ctx = this.ctx;
    if (!ctx || !run.bus) return;
    const l = run.track.voicing.lead;
    const dur = Math.max(0.05, note.len * sd * 0.9);
    const peak = l.level * note.vel;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(l.cutoff * 1.6, t);
    filter.frequency.exponentialRampToValueAtTime(l.cutoff, t + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    g.gain.setTargetAtTime(peak * l.sustain, t + 0.004, l.decay / 3);
    g.gain.setTargetAtTime(0.0001, t + dur, 0.03);
    filter.connect(g);
    g.connect(run.bus);
    if (run.delayIn) g.connect(run.delayIn);

    const voices = l.detune > 0 ? [-l.detune, l.detune] : [0];
    for (const cents of voices) {
      const o = ctx.createOscillator();
      o.type = l.wave;
      o.frequency.value = hz(note.midi);
      o.detune.value = cents;
      o.connect(filter);
      o.start(t);
      o.stop(t + dur + 0.25);
    }
  }

  private pad(run: Run, t: number, midis: readonly number[], dur: number) {
    const ctx = this.ctx;
    if (!ctx || !run.bus) return;
    const p = run.track.voicing.pad;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = p.cutoff;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(p.level, t + 0.35);
    g.gain.setValueAtTime(p.level, t + Math.max(0.36, dur - 0.1));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
    filter.connect(g);
    g.connect(run.bus);
    for (const midi of midis) {
      for (const cents of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = hz(midi);
        o.detune.value = cents;
        o.connect(filter);
        o.start(t);
        o.stop(t + dur + 0.5);
      }
    }
  }

  // -------------------------------------------------------------- effects

  sfx(name: SfxName) {
    const ctx = this.ctx;
    const bus = this.sfxBus;
    if (!ctx || !bus || this.muted || ctx.state !== "running") return;
    const t = ctx.currentTime + 0.005;
    const blip = (at: number, type: OscillatorType, f0: number, f1: number, dur: number, peak: number) =>
      this.tone(bus, t + at, type, f0, f1, dur, peak, dur);

    switch (name) {
      case "intro":
        blip(0, "sine", 392, 523, 0.16, 0.16);
        blip(0.09, "sine", 523, 659, 0.16, 0.14);
        blip(0.18, "sine", 659, 784, 0.2, 0.12);
        break;
      case "perfect":
        blip(0, "triangle", 1320, 1760, 0.09, 0.22);
        blip(0, "sine", 2640, 2640, 0.04, 0.05);
        break;
      case "nice":
        blip(0, "triangle", 988, 1175, 0.08, 0.17);
        break;
      case "early":
        blip(0, "square", 311, 311, 0.04, 0.07);
        break;
      case "blind":
        blip(0, "triangle", 294, 110, 0.18, 0.18);
        break;
      case "heart":
        blip(0, "sine", 150, 52, 0.26, 0.26);
        blip(0.015, "square", 900, 300, 0.1, 0.04);
        this.noiseHit(bus, t, 0.12, "lowpass", 900, 0.7, 0.12);
        break;
      case "milestone":
        blip(0, "sine", 784, 784, 0.26, 0.14);
        blip(0.025, "sine", 988, 988, 0.26, 0.12);
        blip(0.05, "sine", 1175, 1175, 0.26, 0.1);
        break;
      case "stage":
        [523, 659, 784, 1047].forEach((f, i) => blip(i * 0.06, "triangle", f, f, 0.18, 0.13));
        break;
      case "complete":
        blip(0, "sine", 1047, 1319, 0.14, 0.14);
        blip(0.06, "sine", 1568, 1568, 0.18, 0.1);
        break;
      case "over":
        blip(0, "square", 392, 392, 0.22, 0.09);
        blip(0.24, "square", 294, 294, 0.4, 0.09);
        blip(0, "sine", 196, 196, 0.22, 0.12);
        blip(0.24, "sine", 147, 147, 0.4, 0.12);
        break;
    }
  }

  // -------------------------------------------------------------- lifecycle

  private later(fn: () => void, ms: number) {
    const id = window.setTimeout(() => {
      this.timeouts.delete(id);
      fn();
    }, ms);
    this.timeouts.add(id);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    for (const id of this.timeouts) window.clearTimeout(id);
    this.timeouts.clear();
    this.run = null;
    const ctx = this.ctx;
    this.ctx = null;
    this.music = null;
    this.sfxBus = null;
    this.noise = null;
    if (ctx && ctx.state !== "closed") void ctx.close().catch(() => undefined);
  }
}
