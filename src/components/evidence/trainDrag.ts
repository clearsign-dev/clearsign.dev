// Drag-to-scrub maths for the evidence train, after the reference's slider
// drag controller. The reference works in page-scroll pixels; this works in
// slides (the train's index), which keeps every ratio the same.

export const DRAG = {
  /** Pointer travel before a press becomes a drag; also the tap/drag split. */
  startThresholdPx: 12,
  velocityWindowMs: 80,
  /** Overscroll allowed past the first/last slide, in slides. */
  rubberBand: 0.18,
  /** Under this much intent (slides) a release stays on its slide. */
  commitFraction: 0.35,
  /** Seconds of velocity projected into the release. */
  projectionSec: 0.55,
  minDurationSec: 0.35,
  maxDurationSec: 1.4,
  tapMaxMs: 350,
  tapMaxPx: 14,
  /** The reference floors speed at 1px/s of scroll: far below this. */
  minSpeed: 0.01,
} as const;

export type DragSample = { t: number; index: number };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Resist past either end: approach edge + band asymptotically. */
export function rubberBand(index: number, maxIndex: number): number {
  const r = DRAG.rubberBand;
  if (index < 0) return -r * (1 - Math.exp(index / r));
  if (index > maxIndex) return maxIndex + r * (1 - Math.exp(-(index - maxIndex) / r));
  return index;
}

export function trimSamples(samples: DragSample[], now: number) {
  const cutoff = now - DRAG.velocityWindowMs;
  while (samples.length > 1 && samples[0].t < cutoff) samples.shift();
}

/** Slides per second over the recent samples. */
export function sampleVelocity(samples: DragSample[]): number {
  if (samples.length < 2) return 0;
  const first = samples[0];
  const last = samples[samples.length - 1];
  const dt = (last.t - first.t) / 1000;
  return dt > 0.001 ? (last.index - first.index) / dt : 0;
}

/**
 * Where a released drag settles and how long it takes: project the fling,
 * then snap. Less than `commitFraction` of a slide of intent stays put;
 * anything more moves at least one slide in the fling's direction.
 */
export function releaseTarget(
  startIndex: number,
  currentIndex: number,
  velocity: number,
  maxIndex: number,
  reducedMotion: boolean,
) {
  const tau = reducedMotion ? 0 : DRAG.projectionSec;
  const projected = currentIndex + velocity * tau;
  const startSlide = Math.round(startIndex);
  const intent = projected - startIndex;
  const target =
    Math.abs(intent) < DRAG.commitFraction
      ? startSlide
      : startSlide + Math.sign(intent) * Math.max(1, Math.round(Math.abs(intent)));
  const index = clamp(target, 0, maxIndex);
  const distance = Math.abs(index - currentIndex);
  const duration = reducedMotion
    ? 0
    : clamp(distance / Math.max(Math.abs(velocity), DRAG.minSpeed), DRAG.minDurationSec, DRAG.maxDurationSec);
  return { index, duration };
}

/**
 * Duration of a keyboard or tap step: as if flung exactly that far, i.e. at
 * distance / projectionSec slides per second.
 */
export function stepDuration(distance: number): number {
  return clamp(Math.abs(distance) * DRAG.projectionSec, DRAG.minDurationSec, DRAG.maxDurationSec);
}

/** The scroll-to easing the reference hands to Lenis (exponential out). */
export function expoOut(t: number): number {
  return Math.min(1, 1.001 - Math.pow(2, -10 * t));
}
