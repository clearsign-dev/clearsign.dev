// Geometry for the evidence train: the reference draws its slides as planes in
// a perspective camera; here they are DOM cards under a CSS perspective that
// uses the same camera, so every distance below is in the reference's scene
// units ("world") or the slider group's own units ("local") and is converted
// to pixels once per resize.

export type TrainTier = "desktop" | "tablet" | "phone";

const TABLET_MAX_WIDTH = 1024;
const PHONE_MAX_WIDTH = 767;
// The reference narrows the camera's field of view at 768px, not 767.
const FOV_SWITCH_WIDTH = 768;

const DEG = Math.PI / 180;

export const TRAIN = {
  // Layout of one slide relative to the focus point (group-local units).
  stepMultiplier: 1.08,
  inactiveScale: 0.9,
  activeScale: 1.025,
  baseY: -0.3,
  activeYOffset: -0.2,
  activeZOffset: 0.42,
  focusFalloff: 1.24,
  distancePower: 0.94,
  // How far the train leaves to the left once the last slide has been read.
  exitDistance: 20,
  // Entry: slides in from the right while the camera closes in (world units).
  entryX: 8,
  entryZ: -4,
  // Settling: 1 / snapSettlingSpeed (2.5/s).
  settleMs: 400,
  // The per-slide focus value lerps 0.14 per frame, about 110ms.
  focusMs: 110,
  // Entry and exit glide, so a scroll jump never pops the train.
  phaseMs: 120,
  velocity: { gain: 3.6, max: 1.3, attack: 11, release: 5.5 },
  curve: { strength: 10, frequency: 10, maxCurve: 4, yInfluence: 0.9 },
  // A DOM card is rigid where the reference plane bends; keep the lean legible.
  curveGain: 0.7,
  maxLeanDeg: 24,
} as const;

export type TrainMetrics = {
  tier: TrainTier;
  vw: number;
  vh: number;
  /** Pixels per scene unit at the train's depth. */
  pxPerWorld: number;
  /** CSS perspective: the camera's distance to the train, in px. */
  perspective: number;
  /** Pixels per group-local unit. */
  unit: number;
  /** Distance between neighbouring slide centres, local units. */
  stepLocal: number;
  cardW: number;
  cardH: number;
  /** Where the group's local y = 0 lands, px from the top of the section. */
  originY: number;
  /** Phase of the velocity wave per px of x. */
  waveK: number;
  curveScale: number;
  /** Per-slide pointer travel for a drag, px. */
  dragPxPerSlide: number;
};

/** Free vertical band on narrow layouts (between description and heading). */
export type TrainBand = { top: number; bottom: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function mobileViewportScale(vw: number) {
  if (vw < 420) return 0.34;
  if (vw < 560) return 0.42;
  return 0.62;
}

function mobileCurveScale(vw: number) {
  if (vw < 420) return 0.4;
  if (vw < 560) return 0.46;
  if (vw < FOV_SWITCH_WIDTH) return 0.52;
  return 0.58;
}

export function computeTrainMetrics(vw: number, vh: number, band: TrainBand | null): TrainMetrics {
  if (vw > TABLET_MAX_WIDTH) {
    // Camera: fov 22.89deg, 9.84 units from the train, 0.077 below its centre.
    const distance = 9.84;
    const halfTan = Math.tan((22.89 / 2) * DEG);
    const pxPerWorld = vh / (2 * distance * halfTan);
    const t = clamp((vw - 375) / (1440 - 375), 0, 1);
    const groupScale = (0.8 + 0.1 * t) * 0.5;
    const unit = groupScale * pxPerWorld;
    const planeW = 8;
    const gap = 0.07;
    return {
      tier: "desktop",
      vw,
      vh,
      pxPerWorld,
      perspective: distance * pxPerWorld,
      unit,
      stepLocal: (planeW + gap) * TRAIN.stepMultiplier,
      cardW: planeW * unit,
      cardH: 4 * unit,
      originY: vh / 2 - 0.077 * pxPerWorld,
      waveK: (Math.PI * TRAIN.curve.frequency) / ((planeW + gap) * 5.5 * pxPerWorld),
      curveScale: 1,
      dragPxPerSlide: Math.max(140, vw / 2.5),
    };
  }

  // Phone and tablet: fov 30/33deg, about 16 units away; the card keeps one
  // width law across the band (6.756 world units per unit of aspect).
  const distance = 16;
  const halfTan = Math.tan(((vw > FOV_SWITCH_WIDTH ? 30 : 33) / 2) * DEG);
  const pxPerWorld = vh / (2 * distance * halfTan);
  const aspect = clamp(vw / Math.max(1, vh), 0.4, 0.78);
  const worldW = 6.756 * aspect;
  const planeW = 10 * mobileViewportScale(vw);
  const gap = -0.2;
  const unit = (worldW / planeW) * pxPerWorld;
  const cardW = worldW * pxPerWorld;
  const tier: TrainTier = vw <= PHONE_MAX_WIDTH ? "phone" : "tablet";

  // Text cards need more height than the reference's 2:1 artwork.
  let cardH = tier === "phone" ? cardW * 1.15 : cardW / 1.6;
  // The group sits 0.73 units above the camera axis; the focused card 0.5 lower.
  let focusCentre = vh / 2 - 0.73 * pxPerWorld + 0.5 * unit;
  if (band && band.bottom > band.top) {
    // Focused cards grow ~6% (scale plus depth); keep that clear of the copy.
    const grow = 1.06;
    cardH = Math.max(cardW * 0.5, Math.min(cardH, (band.bottom - band.top) / grow));
    const half = (cardH * grow) / 2;
    const lo = band.top + half;
    const hi = band.bottom - half;
    focusCentre = lo <= hi ? clamp(focusCentre, lo, hi) : (band.top + band.bottom) / 2;
  }

  return {
    tier,
    vw,
    vh,
    pxPerWorld,
    perspective: distance * pxPerWorld,
    unit,
    stepLocal: (planeW + gap) * TRAIN.stepMultiplier,
    cardW,
    cardH,
    originY: focusCentre - 0.5 * unit,
    waveK: (Math.PI * TRAIN.curve.frequency) / ((planeW + gap) * 5.5 * pxPerWorld),
    curveScale: mobileCurveScale(vw),
    dragPxPerSlide: Math.max(140, vw / 1.3),
  };
}

export function smoothstep01(x: number) {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
}

export function smootherstep01(x: number) {
  const t = clamp(x, 0, 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

const easeOutCubic = (x: number) => 1 - (1 - clamp(x, 0, 1)) ** 3;

/** Focus of slide `index` when the train's visual index is `visual`. */
export function slideFocus(index: number, visual: number) {
  return smoothstep01(1 - Math.abs(index - visual) / TRAIN.focusFalloff);
}

export type SlidePose = {
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  focus: number;
};

export type TrainOffsets = {
  /** Whole-train shift, px (entry). */
  x: number;
  z: number;
  /** Exit shift, local units. */
  exitLocal: number;
};

/**
 * Pose of one slide, relative to the camera axis (x) and the group origin (y).
 * CSS axes: +x right, +y down, +z toward the viewer.
 */
export function slidePose(
  index: number,
  visual: number,
  velocity: number,
  m: TrainMetrics,
  offsets: TrainOffsets,
): SlidePose {
  const d = index - visual;
  const focus = slideFocus(index, visual);
  const soft = Math.sign(d) * Math.abs(d) ** TRAIN.distancePower;
  const scale = TRAIN.inactiveScale + (TRAIN.activeScale - TRAIN.inactiveScale) * focus;

  const x = (soft * m.stepLocal + offsets.exitLocal) * m.unit + offsets.x;
  let y = -(TRAIN.baseY + TRAIN.activeYOffset * focus) * m.unit;
  let z = TRAIN.activeZOffset * focus * m.unit + offsets.z;
  let rotY = 0;

  if (Math.abs(velocity) > 1e-5) {
    // The reference bends each vertex along a sine of its world x, scaled by
    // scroll velocity. Sample the card's edges and centre and lean it rigidly.
    const influence = velocity * TRAIN.curve.strength * m.curveScale * 0.22;
    const toPx = scale * m.unit * TRAIN.curveGain;
    const zAmp = influence * TRAIN.curve.maxCurve * 0.22 * toPx;
    const yAmp = influence * TRAIN.curve.yInfluence * 0.12 * toPx;
    const half = (m.cardW * scale) / 2;
    // Phase `w` in the reference's terms is waveK * px / pi.
    const zAt = (px: number) => Math.sin(m.waveK * px) * zAmp;
    const yAt = (px: number) =>
      Math.sin(((m.waveK * px) / Math.PI + Math.PI / 2) * 0.8 * Math.PI) * yAmp;
    const zl = zAt(x - half);
    const zr = zAt(x + half);
    z += (zl + 2 * zAt(x) + zr) / 4;
    y -= (yAt(x - half) + 2 * yAt(x) + yAt(x + half)) / 4;
    const lean = -Math.atan2(zr - zl, 2 * half) / DEG;
    rotY = clamp(lean, -TRAIN.maxLeanDeg, TRAIN.maxLeanDeg);
  }

  return { x, y, z, rotY, scale, focus };
}

/** Entry: slide in from the right and close in, fading up part-way. */
export function entryOffsets(entry: number, m: TrainMetrics, reduced: boolean) {
  const e = easeOutCubic(entry);
  return {
    x: reduced ? 0 : TRAIN.entryX * (1 - e) * m.pxPerWorld,
    z: reduced ? 0 : TRAIN.entryZ * (1 - e) * m.pxPerWorld,
    opacity: smoothstep01((entry - 0.3) / 0.45),
  };
}

/** Exit: leave to the left, fading once most of the way gone. */
export function exitOffsets(exit: number, reduced: boolean) {
  return {
    exitLocal: reduced ? 0 : -TRAIN.exitDistance * smootherstep01(exit),
    opacity: 1 - smoothstep01((exit - 0.55) / 0.45),
  };
}

export type VelocityState = { prev: number; target: number; value: number };

/** Scroll velocity for the curve, smoothed as the reference smooths it. */
export function stepVelocity(state: VelocityState, progressNow: number, dtSec: number) {
  const raw = dtSec > 0 ? (progressNow - state.prev) / dtSec : 0;
  state.prev = progressNow;
  const { gain, max, attack, release } = TRAIN.velocity;
  const boosted = clamp(raw * gain, -max, max);
  const rate = Math.abs(boosted) > Math.abs(state.target) ? attack : release;
  const alpha = 1 - Math.exp(-dtSec * rate);
  state.target += (boosted - state.target) * alpha;
  state.value += (state.target - state.value) * alpha;
}
