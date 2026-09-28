// The three tracks, written as step-sequencer data (sixteen steps a bar). The
// audio engine plays these steps and the chart is derived from the very same
// steps, so every byte on the highway sits on a sound that is actually played.

export interface Tone {
  midi: number;
  /** Length in steps. */
  len: number;
  vel: number;
  accent?: boolean;
}

export interface Step {
  kick?: number;
  snare?: number;
  clap?: number;
  rim?: number;
  hat?: number;
  openHat?: number;
  bass?: Tone;
  lead?: Tone;
  pad?: { midis: readonly number[]; len: number };
}

export interface Voicing {
  kick: { from: number; to: number; decay: number; level: number };
  snare: { level: number; tone: number };
  hat: { level: number; tone: number };
  bass: { wave: OscillatorType; cutoff: number; q: number; envAmount: number; sub: number; level: number; gate: number };
  lead: { wave: OscillatorType; detune: number; cutoff: number; decay: number; sustain: number; level: number };
  delay: { beats: number; feedback: number; mix: number };
  pad: { level: number; cutoff: number };
}

export interface Track {
  id: string;
  label: string;
  bpm: number;
  /** Fraction of a step that odd sixteenths are pushed late. */
  swing: number;
  introBars: number;
  loopBars: number;
  voicing: Voicing;
  steps: readonly Step[];
}

export const STEPS_PER_BAR = 16;
export const STEPS_PER_BEAT = 4;

// ---------------------------------------------------------------- helpers

type DrumKey = "kick" | "snare" | "clap" | "rim" | "hat" | "openHat";

function blank(bars: number): Step[] {
  return Array.from({ length: bars * STEPS_PER_BAR }, () => ({}));
}

/** "X" full, "x" medium, "o" ghost, anything else rest. */
function drum(steps: Step[], bar: number, key: DrumKey, pattern: string, scale = 1) {
  for (let i = 0; i < STEPS_PER_BAR; i++) {
    const c = pattern[i];
    const vel = c === "X" ? 1 : c === "x" ? 0.72 : c === "o" ? 0.38 : 0;
    if (vel > 0) steps[bar * STEPS_PER_BAR + i][key] = vel * scale;
  }
}

function note(steps: Step[], bar: number, step: number, key: "bass" | "lead", tone: Tone) {
  steps[bar * STEPS_PER_BAR + step][key] = tone;
}

/** Chord tone by index; indexes past the chord climb an octave. */
function chordTone(chord: readonly number[], index: number): number {
  return chord[index % chord.length] + 12 * Math.floor(index / chord.length);
}

// ---------------------------------------------------------------- tracks

function coldStorage(): Step[] {
  const intro = 2;
  const s = blank(intro + 16);
  const chords = [
    [57, 60, 64, 67],
    [53, 57, 60, 64],
    [55, 59, 60, 64],
    [55, 59, 62, 64],
  ];
  const roots = [45, 41, 48, 43];

  for (let bar = 0; bar < intro + 16; bar++) {
    const lb = bar - intro;
    const inIntro = lb < 0;
    const c = inIntro ? 0 : lb % 4;
    const second = lb >= 8;
    const r = roots[c];

    drum(s, bar, "kick", second ? "X......x..x....." : "X.........x.....");
    drum(s, bar, "hat", "..x...x...x...x.", 0.7);
    if (!inIntro) drum(s, bar, "rim", "....X.......X...");
    if (!inIntro && lb % 2 === 1) {
      s[bar * STEPS_PER_BAR + 14].hat = undefined;
      s[bar * STEPS_PER_BAR + 14].openHat = 0.6;
    }

    const bassVel = inIntro ? 0.6 : 1;
    if (inIntro || lb % 2 === 0) {
      note(s, bar, 0, "bass", { midi: r, len: 7, vel: bassVel });
    } else {
      note(s, bar, 0, "bass", { midi: r, len: 3, vel: bassVel });
      note(s, bar, 4, "bass", { midi: r + 7, len: 3, vel: 0.8 });
    }
    note(s, bar, 10, "bass", { midi: r + 12, len: 2, vel: 0.7 });
    note(s, bar, 12, "bass", { midi: r, len: 3, vel: 0.8 });

    if (inIntro) continue;
    const chord = chords[c];
    s[bar * STEPS_PER_BAR].pad = { midis: chord, len: 16 };

    const lead = (step: number, index: number, len: number, vel: number) =>
      note(s, bar, step, "lead", { midi: chordTone(chord, index) + 12, len, vel });

    if (!second) {
      lead(0, 0, 2, 1);
      lead(3, 2, 2, 0.7);
      lead(6, 1, 2, 0.8);
      if (lb % 4 === 3) {
        lead(8, 3, 8, 0.9);
      } else {
        lead(8, 3, 2, 0.9);
        lead(11, 2, 2, 0.7);
        lead(14, 1, 2, 0.75);
      }
    } else if (lb === 15) {
      [0, 1, 2, 3].forEach((index, i) => lead(i * 2, index, 2, i === 0 ? 1 : 0.75));
      lead(8, 4, 8, 0.95);
    } else {
      [0, 1, 2, 3, 4, 3, 2, 1].forEach((index, i) => lead(i * 2, index, 2, i % 2 === 0 ? 0.95 : 0.7));
    }
  }
  return s;
}

function mempool(): Step[] {
  const intro = 2;
  const s = blank(intro + 16);
  const chords = [
    [62, 65, 69, 74],
    [58, 62, 65, 70],
    [60, 65, 69, 72],
    [60, 64, 67, 72],
  ];
  const roots = [38, 34, 41, 36];

  for (let bar = 0; bar < intro + 16; bar++) {
    const lb = bar - intro;
    const inIntro = lb < 0;
    const c = inIntro ? 0 : lb % 4;
    const second = lb >= 8;
    const r = roots[c];

    drum(s, bar, "kick", "X...X...X...X...");
    for (let i = 0; i < STEPS_PER_BAR; i++) {
      const step = s[bar * STEPS_PER_BAR + i];
      if (i === 14) step.openHat = 0.55;
      else step.hat = i % 4 === 2 ? 0.9 : i % 2 === 0 ? 0.5 : 0.34;
    }
    if (!inIntro) {
      drum(s, bar, "snare", "....X.......X...");
      if (lb % 8 === 7) drum(s, bar, "snare", "....X.......xxXX");
    }

    for (let i = 0; i < STEPS_PER_BAR; i += 2) {
      note(s, bar, i, "bass", {
        midi: r + (i % 4 === 2 ? 12 : 0),
        len: 2,
        vel: (inIntro ? 0.6 : 1) * (i % 4 === 0 ? 1 : 0.75),
      });
    }

    if (inIntro) continue;
    const chord = chords[c];
    const lead = (step: number, index: number, len: number, vel: number) =>
      note(s, bar, step, "lead", { midi: chordTone(chord, index) + 12, len, vel });

    if (!second) {
      lead(0, 2, 3, 1);
      lead(3, 1, 3, 0.8);
      lead(6, 0, 2, 0.8);
      lead(8, 1, 2, 0.9);
      lead(10, 2, 2, 0.8);
      lead(12, 3, 4, 0.95);
    } else {
      const arp = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 5, 4, 3];
      const last = lb === 15;
      for (let i = 0; i < (last ? 8 : 16); i++) lead(i, arp[i], 1, i % 4 === 0 ? 0.8 : 0.55);
      if (last) lead(8, 4, 8, 1);
    }
  }
  return s;
}

function gasWar(): Step[] {
  const intro = 2;
  const s = blank(intro + 16);
  const chords = [
    [64, 67, 71, 76],
    [65, 69, 72, 77],
    [67, 71, 74, 79],
    [65, 69, 72, 77],
  ];
  const roots = [40, 41, 43, 41];
  const acid: ReadonlyArray<[number, number, number, boolean]> = [
    // step, offset from root, length, accent
    [0, 0, 2, true],
    [3, 12, 1, false],
    [6, 0, 2, false],
    [8, 1, 1, false],
    [10, 12, 1, true],
    [11, 0, 1, false],
    [14, 10, 2, false],
  ];

  for (let bar = 0; bar < intro + 16; bar++) {
    const lb = bar - intro;
    const inIntro = lb < 0;
    const c = inIntro ? 0 : lb % 4;
    const second = lb >= 8;
    const fill = !inIntro && lb % 4 === 3;
    const r = roots[c];

    drum(s, bar, "kick", fill ? "X..x..x...x....." : "X..x..x...x..x..");
    for (let i = 0; i < STEPS_PER_BAR; i++) {
      const step = s[bar * STEPS_PER_BAR + i];
      if (second && (i === 6 || i === 14)) step.openHat = 0.5;
      else step.hat = i % 4 === 2 ? 0.75 : 0.35;
    }
    if (!inIntro) {
      drum(s, bar, "clap", "....X.......X...");
      drum(s, bar, "snare", ".......o.......o");
      if (fill) drum(s, bar, "snare", ".......o....xxXX");
    }

    for (const [step, offset, len, accent] of acid) {
      note(s, bar, step, "bass", {
        midi: r + offset,
        len,
        vel: (inIntro ? 0.6 : 1) * (accent ? 1 : 0.7),
        accent,
      });
    }

    if (inIntro) continue;
    const chord = chords[c];
    const lead = (step: number, index: number, len: number, vel: number) =>
      note(s, bar, step, "lead", { midi: chordTone(chord, index), len, vel });

    if (!second) {
      lead(0, 2, 1, 0.9);
      lead(3, 1, 1, 0.8);
      lead(6, 0, 1, 0.8);
      if (lb % 4 === 3) {
        lead(8, 3, 8, 0.95);
      } else {
        lead(10, 2, 1, 0.85);
        lead(12, 3, 1, 0.9);
      }
    } else {
      const last = lb === 15;
      for (let i = 0; i < (last ? 8 : 16); i++) {
        lead(i, (i % 4) + (i >= 8 ? 4 : 0), 1, i % 4 === 0 ? 0.75 : 0.5);
      }
      if (last) lead(8, 3, 8, 1);
    }
  }
  return s;
}

export const TRACKS: readonly Track[] = [
  {
    id: "cold-storage",
    label: "Cold Storage",
    bpm: 84,
    swing: 0.14,
    introBars: 2,
    loopBars: 16,
    voicing: {
      kick: { from: 120, to: 44, decay: 0.42, level: 0.85 },
      snare: { level: 0.34, tone: 1800 },
      hat: { level: 0.09, tone: 7000 },
      bass: { wave: "triangle", cutoff: 520, q: 1, envAmount: 300, sub: 0.5, level: 0.5, gate: 0.92 },
      lead: { wave: "triangle", detune: 0, cutoff: 3200, decay: 0.35, sustain: 0.25, level: 0.2 },
      delay: { beats: 0.75, feedback: 0.38, mix: 0.32 },
      pad: { level: 0.045, cutoff: 900 },
    },
    steps: coldStorage(),
  },
  {
    id: "mempool",
    label: "Mempool",
    bpm: 108,
    swing: 0,
    introBars: 2,
    loopBars: 16,
    voicing: {
      kick: { from: 150, to: 46, decay: 0.34, level: 0.9 },
      snare: { level: 0.42, tone: 1500 },
      hat: { level: 0.07, tone: 8000 },
      bass: { wave: "sawtooth", cutoff: 700, q: 4, envAmount: 1400, sub: 0, level: 0.28, gate: 0.6 },
      lead: { wave: "square", detune: 6, cutoff: 2400, decay: 0.18, sustain: 0.3, level: 0.09 },
      delay: { beats: 0.75, feedback: 0.3, mix: 0.22 },
      pad: { level: 0, cutoff: 0 },
    },
    steps: mempool(),
  },
  {
    id: "gas-war",
    label: "Gas War",
    bpm: 136,
    swing: 0,
    introBars: 2,
    loopBars: 16,
    voicing: {
      kick: { from: 170, to: 48, decay: 0.26, level: 0.95 },
      snare: { level: 0.45, tone: 1200 },
      hat: { level: 0.065, tone: 9000 },
      bass: { wave: "sawtooth", cutoff: 380, q: 12, envAmount: 2600, sub: 0, level: 0.24, gate: 0.55 },
      lead: { wave: "sawtooth", detune: 9, cutoff: 2800, decay: 0.12, sustain: 0.2, level: 0.07 },
      delay: { beats: 0.5, feedback: 0.25, mix: 0.18 },
      pad: { level: 0, cutoff: 0 },
    },
    steps: gasWar(),
  },
];

export const DEFAULT_TRACK_ID = TRACKS[1].id;

export function trackById(id: string | null | undefined): Track {
  return TRACKS.find((t) => t.id === id) ?? TRACKS.find((t) => t.id === DEFAULT_TRACK_ID) ?? TRACKS[0];
}

// ---------------------------------------------------------------- timing

export function stepSeconds(track: Track): number {
  return 60 / track.bpm / STEPS_PER_BEAT;
}

export function beatSeconds(track: Track): number {
  return 60 / track.bpm;
}

export function introSteps(track: Track): number {
  return track.introBars * STEPS_PER_BAR;
}

export function loopSteps(track: Track): number {
  return track.loopBars * STEPS_PER_BAR;
}

/** Absolute time of global step `i` for a run whose step 0 is at `t0`. */
export function stepTime(track: Track, t0: number, i: number): number {
  const d = stepSeconds(track);
  return t0 + i * d + (i % 2 === 1 ? track.swing * d : 0);
}

/** The sequencer event at global step `i`: intro once, then the loop forever. */
export function stepAt(track: Track, i: number): Step {
  const intro = introSteps(track);
  if (i < intro) return track.steps[i];
  return track.steps[intro + ((i - intro) % loopSteps(track))];
}

export type Level = 1 | 2 | 3;

export function levelOf(track: Track): { level: Level; label: string } {
  if (track.bpm < 95) return { level: 1, label: "Easy" };
  if (track.bpm < 115) return { level: 2, label: "Medium" };
  return { level: 3, label: "Hard" };
}

/** First loop bar as four rows of sixteen dots: kick, snare, hats, melody. */
export function trackGlyph(track: Track): boolean[][] {
  const start = introSteps(track);
  const rows: boolean[][] = [[], [], [], []];
  for (let i = 0; i < STEPS_PER_BAR; i++) {
    const st = track.steps[start + i];
    rows[0].push((st.kick ?? 0) >= 0.5);
    rows[1].push(Math.max(st.snare ?? 0, st.clap ?? 0, st.rim ?? 0) >= 0.5);
    rows[2].push((st.hat ?? 0) > 0 || (st.openHat ?? 0) > 0);
    rows[3].push(!!st.lead);
  }
  return rows;
}

// ---------------------------------------------------------------- chart

export interface ChartStep {
  /** Melodic pitch behind the byte (lead, else bass); null for a drum hit. */
  pitch: number | null;
  /** Drum-only bytes sit low (kick) or high (snare/clap/rim). */
  drum: "low" | "high" | null;
  salience: number;
  holdSec: number;
  /** A drum hit meets a lead note on a beat: a chord partner may join. */
  partner: boolean;
}

export interface Chart {
  /** One entry per loop step; null where nothing is worth a byte. */
  steps: readonly (ChartStep | null)[];
  loopSec: number;
  saliencesDesc: readonly number[];
}

export const MIN_HOLD_SEC = 0.45;

function metricWeight(pos: number): number {
  if (pos === 0) return 0.35;
  if (pos === 8) return 0.25;
  if (pos % 4 === 0) return 0.18;
  if (pos % 2 === 0) return 0.08;
  return 0.02;
}

/** Small deterministic value in [0, 1) that breaks salience ties. */
function jitter(i: number): number {
  let h = Math.imul(i + 1, 0x9e3779b1) ^ 0x85ebca6b;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const chartCache = new Map<string, Chart>();

export function chartFor(track: Track): Chart {
  const cached = chartCache.get(track.id);
  if (cached) return cached;

  const intro = introSteps(track);
  const count = loopSteps(track);
  const d = stepSeconds(track);
  const loop = track.steps.slice(intro, intro + count);

  const steps: (ChartStep | null)[] = loop.map((st, i) => {
    const pos = i % STEPS_PER_BAR;
    const kick = st.kick ?? 0;
    const backbeat = Math.max(st.snare ?? 0, st.clap ?? 0);
    const rim = st.rim ?? 0;
    const hasDrum = kick >= 0.5 || backbeat >= 0.5 || rim >= 0.5;
    if (!hasDrum && !st.lead && !st.bass) return null;

    const salience =
      metricWeight(pos) +
      kick * 0.28 +
      backbeat * 0.24 +
      rim * 0.1 +
      (st.lead ? st.lead.vel * 0.26 + (st.lead.len >= 4 ? 0.05 : 0) : 0) +
      (st.bass ? st.bass.vel * 0.12 : 0) +
      jitter(i) * 0.03;

    const pitch = st.lead ? st.lead.midi : st.bass ? st.bass.midi : null;
    const drum = pitch !== null ? null : kick >= 0.5 ? "low" : "high";

    const holdSteps =
      st.lead && st.lead.len >= 4 ? st.lead.len : st.bass && st.bass.len >= 6 ? st.bass.len : 0;
    const holdRaw = holdSteps > 0 ? holdSteps * d - d * 0.5 : 0;
    const holdSec = holdRaw >= MIN_HOLD_SEC ? holdRaw : 0;

    const partner = pos % 4 === 0 && !!st.lead && (kick >= 0.5 || backbeat >= 0.5);

    return { pitch, drum, salience, holdSec, partner };
  });

  const chart: Chart = {
    steps,
    loopSec: count * d,
    saliencesDesc: steps
      .filter((s): s is ChartStep => s !== null)
      .map((s) => s.salience)
      .sort((a, b) => b - a),
  };
  chartCache.set(track.id, chart);
  return chart;
}

/** Salience a byte needs to spawn so the chart plays `density` of its rate. */
export function chartGate(chart: Chart, density: number, notesPerMinutePerDensity: number): number {
  const target = Math.floor(density * notesPerMinutePerDensity * (chart.loopSec / 60));
  if (target <= 0) return Infinity;
  if (target >= chart.saliencesDesc.length) return -Infinity;
  return chart.saliencesDesc[target - 1];
}

// ---------------------------------------------------------------- lanes

/**
 * Lanes follow the melody's contour between the bytes that actually spawn:
 * up the scale moves right, down moves left, a leap moves two lanes, a
 * repeated pitch steps aside, and the walk bounces off the edges. Drum-only
 * bytes sit left (kick) or right (snare), off the previous lane.
 */
export interface LaneWalk {
  lane: number;
  pitch: number | null;
  dir: 1 | -1;
}

export function newLaneWalk(): LaneWalk {
  return { lane: 1, pitch: null, dir: 1 };
}

export function walkLane(walk: LaneWalk, step: ChartStep): number {
  const from = walk.lane;
  let lane: number;
  if (step.pitch === null) {
    const [a, b] = step.drum === "high" ? [2, 3] : [0, 1];
    lane = from === a ? b : from === b ? a : walk.dir > 0 ? b : a;
  } else if (walk.pitch === null) {
    lane = from;
  } else {
    const diff = step.pitch - walk.pitch;
    let move: number = walk.dir;
    if (diff === 0) walk.dir = walk.dir > 0 ? -1 : 1;
    else move = Math.sign(diff) * (Math.abs(diff) >= 9 ? 2 : 1);
    lane = from + move;
    if (lane > 3) lane = from - 1;
    if (lane < 0) lane = from + 1;
    if (diff !== 0) walk.dir = move > 0 ? 1 : -1;
  }
  return lane < 0 ? 0 : lane > 3 ? 3 : lane;
}

/** Chord partner two lanes away, on whichever side has room. */
export function partnerLane(lane: number): number {
  return lane <= 1 ? lane + 2 : lane - 2;
}
