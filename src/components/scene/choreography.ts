// What the scene looks like in each section, and how it gets from one to the
// next. Everything is a pure function of P = step + value (0..8), the stage
// position, which the engine damps before it gets here. Pure: no three.js.

export const FORM = { mark: 0, reads: 1, band: 2, field: 3, ships: 4 } as const;
export type FormId = (typeof FORM)[keyof typeof FORM];

/** The formation each section settles into (hero … contact). */
export const SECTION_FORMS: readonly FormId[] = [
  FORM.mark,
  FORM.mark,
  FORM.reads,
  FORM.band,
  FORM.field,
  FORM.ships,
  FORM.mark,
  FORM.mark,
];

export type Look = {
  /** Half of the viewport's shorter side, in world units at the subject plane. */
  fit: number;
  /** Mark centre in NDC, and its depth. */
  mx: number;
  my: number;
  mz: number;
  scale: number;
  tiltX: number;
  tiltY: number;
  /** Amplitude of the slow breathing rotation. */
  breathe: number;
  /** How far the S has drifted from the C (0..1). */
  split: number;
  bright: number;
  /** getIt's inner light (0..1). */
  glow: number;
  size: number;
  /** Pointer disturbance strength. */
  disturb: number;
  /** Calm the right half of the screen (0..1), where problem's text sits. */
  calmRight: number;
  shimmer: number;
  ca: number;
  vignette: number;
  grid: number;
  parallax: number;
  haze: number;
};

const LOOK_KEYS: (keyof Look)[] = [
  "fit",
  "mx",
  "my",
  "mz",
  "scale",
  "tiltX",
  "tiltY",
  "breathe",
  "split",
  "bright",
  "glow",
  "size",
  "disturb",
  "calmRight",
  "shimmer",
  "ca",
  "vignette",
  "grid",
  "parallax",
  "haze",
];

const BASE: Look = {
  fit: 2.4,
  mx: 0,
  my: 0,
  mz: 0,
  scale: 1,
  tiltX: 0,
  tiltY: 0,
  breathe: 0.5,
  split: 0,
  bright: 1,
  glow: 0,
  size: 1,
  disturb: 0.8,
  calmRight: 0,
  shimmer: 1,
  ca: 1,
  vignette: 0.6,
  grid: 1,
  parallax: 0.8,
  haze: 0.8,
};

const look = (partial: Partial<Look>): Look => ({ ...BASE, ...partial });

// Where the mark waits while other formations hold the stage: problem's pose
// until ships, then getIt's, so each morph leaves from and lands on the mark
// the visitor last saw or is about to see.
const DESKTOP_PROBLEM_MARK: Partial<Look> = { mx: -0.42, my: 0.02, tiltX: 0.06, tiltY: 0.28, split: 1 };
const DESKTOP_GETIT_MARK: Partial<Look> = { mx: -0.45, my: 0.3, scale: 0.72, tiltY: 0.1 };

export const DESKTOP_LOOKS: readonly Look[] = [
  // hero: centred behind the headline, breathing, fully alive to the pointer
  look({ fit: 1.78, my: 0.05, breathe: 1, disturb: 1, vignette: 0.55, parallax: 1, haze: 1 }),
  // problem: pull back, the S drifts off the C; the right half stays quiet
  look({ fit: 2.7, ...DESKTOP_PROBLEM_MARK, breathe: 0.55, bright: 0.92, disturb: 0.85, calmRight: 1, ca: 0.9 }),
  // reads: two byte lattices behind the hotspots, centre dark
  look({ ...DESKTOP_PROBLEM_MARK, breathe: 0.4, bright: 0.95, disturb: 0.6, shimmer: 0.8, ca: 0.85, vignette: 0.65, grid: 0.8, parallax: 0.6, haze: 0.7 }),
  // proof: under the fill, a band low on screen
  look({ ...DESKTOP_PROBLEM_MARK, breathe: 0.4, disturb: 0.35, shimmer: 0.6, ca: 0.7, vignette: 0.7, grid: 0.4, parallax: 0.5, haze: 0.5 }),
  // evidence: a sparse field, calm, the slider's side kept clear
  look({ ...DESKTOP_PROBLEM_MARK, breathe: 0.4, bright: 0.85, disturb: 0.3, shimmer: 0.5, ca: 0.6, vignette: 0.7, grid: 0.6, parallax: 0.4, haze: 0.6 }),
  // ships: four clusters down the right
  look({ ...DESKTOP_GETIT_MARK, bright: 0.95, disturb: 0.55, shimmer: 0.8, ca: 0.8, grid: 0.8, parallax: 0.7, haze: 0.7 }),
  // getIt: the mark again, smaller, lit from within
  look({ ...DESKTOP_GETIT_MARK, breathe: 0.8, bright: 1.15, glow: 1, disturb: 0.9, vignette: 0.55, parallax: 1, haze: 1 }),
  // contact: far and faint
  look({ my: 0.18, mz: -7, breathe: 0.6, bright: 0.45, glow: 0.25, disturb: 0.5, shimmer: 0.8, ca: 0.8, parallax: 0.6 }),
];

const MOBILE_PROBLEM_MARK: Partial<Look> = { fit: 2.3, my: 0.42, tiltX: 0.06, tiltY: 0.28, split: 1 };
const MOBILE_GETIT_MARK: Partial<Look> = { fit: 2.3, my: 0.12, scale: 0.72, tiltY: 0.1 };

// ≤ 1024px. `fit` is half the shorter side, so on a phone the mark spans the
// width; the subject rides up behind the text, which stacks full width here.
export const MOBILE_LOOKS: readonly Look[] = [
  look({ fit: 1.5, my: 0.14, breathe: 1, disturb: 0.9, vignette: 0.5, parallax: 1, haze: 1 }),
  look({ ...MOBILE_PROBLEM_MARK, breathe: 0.55, bright: 0.9, disturb: 0.6 }),
  look({ ...MOBILE_PROBLEM_MARK, breathe: 0.4, bright: 0.95, disturb: 0.5, shimmer: 0.8, ca: 0.85, vignette: 0.6, grid: 0.8, parallax: 0.6, haze: 0.7 }),
  look({ ...MOBILE_PROBLEM_MARK, breathe: 0.4, disturb: 0.3, shimmer: 0.6, ca: 0.7, vignette: 0.65, grid: 0.4, parallax: 0.5, haze: 0.5 }),
  look({ ...MOBILE_PROBLEM_MARK, breathe: 0.4, bright: 0.85, disturb: 0.25, shimmer: 0.5, ca: 0.6, vignette: 0.65, grid: 0.6, parallax: 0.4, haze: 0.6 }),
  look({ ...MOBILE_GETIT_MARK, bright: 0.9, disturb: 0.45, shimmer: 0.8, ca: 0.8, grid: 0.8, parallax: 0.7, haze: 0.7 }),
  look({ ...MOBILE_GETIT_MARK, breathe: 0.8, bright: 1.15, glow: 1, disturb: 0.8, vignette: 0.5, parallax: 1, haze: 1 }),
  look({ fit: 2.3, my: 0.3, mz: -7, breathe: 0.6, bright: 0.45, glow: 0.25, disturb: 0.4, shimmer: 0.8, ca: 0.8, parallax: 0.6 }),
];

/** Formation layout: where the screen-anchored formations sit. */
export type FormLayout = {
  /** Vertical field of view, degrees, for landscape and portrait viewports. */
  fovLandscape: number;
  fovPortrait: number;
  /** Reads lattices: centre x (±), centre y, and each lattice's width, in NDC. */
  readsX: number;
  readsY: number;
  readsWidth: number;
  /** Band height at the subject plane, NDC. */
  bandY: number;
  /** Field: the NDC rectangle kept clear (x0, y0, x1, y1), and how many points it shows. */
  fieldClear: [number, number, number, number];
  fieldPoints: number;
  /** Ship clusters: NDC x, NDC y, world z each, and their size. */
  ships: [number, number, number][];
  shipsScale: number;
  /** Where the S drifts to in problem, mark units. */
  splitOffset: [number, number, number];
};

export const DESKTOP_LAYOUT: FormLayout = {
  fovLandscape: 40,
  fovPortrait: 55,
  // The hotspots sit at 14% and 86% of the width, on the vertical centre.
  readsX: 0.72,
  readsY: 0,
  readsWidth: 0.36,
  bandY: -0.62,
  // The slider's description and cards live centre-left.
  fieldClear: [-0.95, -0.7, 0.15, 0.75],
  fieldPoints: 14000,
  ships: [
    [0.56, 0.52, 0],
    [0.74, 0.16, -1],
    [0.58, -0.2, -2],
    [0.76, -0.55, -3],
  ],
  shipsScale: 1,
  splitOffset: [0.72, -0.06, -1.9],
};

export const MOBILE_LAYOUT: FormLayout = {
  fovLandscape: 40,
  fovPortrait: 55,
  // The hotspots are hidden ≤ 1024 and the cards take the bottom: the lattices
  // sit in the upper half instead.
  readsX: 0.5,
  readsY: 0.3,
  readsWidth: 0.62,
  bandY: -0.7,
  fieldClear: [-1.3, -0.5, 1.3, 0.42],
  fieldPoints: 5000,
  ships: [
    [0.62, 0.55, 0],
    [0.72, 0.2, -1],
    [0.6, -0.15, -2],
    [0.7, -0.5, -3],
  ],
  shipsScale: 0.55,
  splitOffset: [0.55, -0.35, -1.6],
};

// Hand-over windows between section k and k + 1, in P. They straddle the
// boundary so the scene is already moving as the next section's text arrives.
const LOOK_WINDOWS: readonly [number, number][] = [
  [0.72, 1.55], // hero → problem: pull back, open the gap
  [1.8, 2.3], // problem → reads
  [2.86, 3.3], // reads → proof
  [3.84, 4.14], // proof → evidence, under the clearing fill
  [4.86, 5.3], // evidence → ships
  [5.84, 6.32], // ships → getIt
  [6.78, 7.35], // getIt → contact
];

const FORM_WINDOWS: readonly [number, number][] = [
  [0.72, 1.55],
  [1.82, 2.32], // the points leave the mark for the lattices
  [2.95, 3.38], // they gather into the band as the fill comes in
  [3.86, 4.12], // band → field while the fill clears
  [4.88, 5.3],
  [5.86, 6.34], // the mark re-forms
  [6.78, 7.35],
];

/** The proof fill: sweeps in over proof's first 35%, clears as evidence begins. */
const FILL_IN: [number, number] = [3.0, 3.35];
const FILL_OUT: [number, number] = [3.82, 4.12];

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smootherstep = (x: number) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

export function copyLook(from: Look, out: Look): Look {
  for (const k of LOOK_KEYS) out[k] = from[k];
  return out;
}

export function createLook(): Look {
  return { ...BASE };
}

export function evaluateLook(P: number, table: readonly Look[], out: Look): Look {
  for (let k = 0; k < table.length - 1; k++) {
    const [a, b] = LOOK_WINDOWS[k];
    if (P < a) return copyLook(table[k], out);
    if (P <= b) {
      const t = smootherstep((P - a) / (b - a));
      const from = table[k];
      const to = table[k + 1];
      for (const key of LOOK_KEYS) out[key] = from[key] + (to[key] - from[key]) * t;
      return out;
    }
  }
  return copyLook(table[table.length - 1], out);
}

export type FormBlend = { from: FormId; to: FormId; t: number };

/** The two formations in play and the linear blend between them (the shader staggers it per point). */
export function evaluateForm(P: number, out: FormBlend): FormBlend {
  for (let k = 0; k < SECTION_FORMS.length - 1; k++) {
    const from = SECTION_FORMS[k];
    const to = SECTION_FORMS[k + 1];
    if (from === to) continue;
    const [a, b] = FORM_WINDOWS[k];
    if (P < a) {
      out.from = from;
      out.to = from;
      out.t = 0;
      return out;
    }
    if (P <= b) {
      out.from = from;
      out.to = to;
      out.t = clamp01((P - a) / (b - a));
      return out;
    }
  }
  const last = SECTION_FORMS[SECTION_FORMS.length - 1];
  out.from = last;
  out.to = last;
  out.t = 0;
  return out;
}

/** Reduced motion: each section's own state, no morph. */
export function formForStep(step: number, out: FormBlend): FormBlend {
  const f = SECTION_FORMS[Math.max(0, Math.min(SECTION_FORMS.length - 1, step))];
  out.from = f;
  out.to = f;
  out.t = 0;
  return out;
}

export function lookForStep(step: number, table: readonly Look[], out: Look): Look {
  return copyLook(table[Math.max(0, Math.min(table.length - 1, step))], out);
}

/** Fill sweep amounts: [in, out], each 0..1. */
export function evaluateFill(P: number): [number, number] {
  return [
    clamp01((P - FILL_IN[0]) / (FILL_IN[1] - FILL_IN[0])),
    clamp01((P - FILL_OUT[0]) / (FILL_OUT[1] - FILL_OUT[0])),
  ];
}

export const PROOF_STEP = 3;

/** How much of the blend is the mark (for the getIt glow). */
export function markWeight(form: FormBlend): number {
  const a = form.from === FORM.mark ? 1 : 0;
  const b = form.to === FORM.mark ? 1 : 0;
  return a + (b - a) * form.t;
}
