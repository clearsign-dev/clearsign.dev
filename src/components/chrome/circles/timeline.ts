import { clamp01 } from "@/lib/motion/progress";

// The concentric-circle overlay's choreography, as a pure function of stage
// progress.
//
// The reference drives this overlay from its 3D scene clock, which is a linear
// map of each section's progress onto that section's slice of the scene. Our
// sections are paced differently, so rather than reuse its raw numbers we
// rebuild the same clock from (section, progress in section). Each of our
// sections takes the slice of the reference section it borrows from
// (problem ← About, reads ← Services, proof ← Collaboration, ...), and every
// beat below is a point on that clock. The overlay therefore moves through each
// of our sections exactly as it moves through the matching reference section,
// including the change of pace at each boundary.

/** Section boundaries on the reference's scene clock (frames of a 2801-frame clip). */
const CLOCK_BOUNDS = [0, 260, 350, 750, 800, 1300, 1450, 2720, 2801].map((frame) => frame / 2801);

/** Reference scene-clock position for a point in our stage. */
export function sceneClock(step: number, value: number): number {
  const last = CLOCK_BOUNDS.length - 2;
  if (step < 0) return 0;
  if (step > last) return 1;
  const from = CLOCK_BOUNDS[step];
  const to = CLOCK_BOUNDS[step + 1];
  return from + (to - from) * clamp01(value);
}

type Window = readonly [start: number, end: number];

// Beats on the scene clock. The comments give where each lands in our sections.
const BEAT = {
  /** All three rings grow out from the centre. hero 0.754 → reads 0.035. */
  bloom: [0.07, 0.13],
  /** The square contracts from the About size to the Services size. reads 0.014 → 0.091. */
  contract: [0.127, 0.138],
  /** Inner ring leaves. reads 0.014 → 0.077. */
  innerOut: [0.127, 0.136],
  /** Middle ring leaves. reads 0.042 → 0.091. */
  middleOut: [0.131, 0.138],
  /** Side circles draw in from the crosshairs. Same window as the contraction. */
  sideIn: [0.127, 0.138],
  /** Side circles fade. reads 0.835 → evidence 0.058. */
  sideOut: [0.24421, 0.296],
  /** The square sweeps past the viewport edges while the outer unit fades. reads 0.906 → evidence 0.058. */
  exit: [0.25433, 0.296],
  /**
   * Reduced motion: no sweep, so everything fades in place instead, done by the
   * end of reads, which is when the sweep has carried it out of view.
   */
  exitInPlace: [0.25433, CLOCK_BOUNDS[3]],
} as const satisfies Record<string, Window>;

/** Outside this window the overlay is hidden and costs nothing. */
const LIVE: Window = [BEAT.bloom[0], BEAT.exit[1]];

/** Outer-ring diameter, % of the viewport width. */
export const CIRCLE_WIDTH = { about: 88, reads: 48, exit: 130 } as const;

/** Rings are born at this fraction of their size and grow to full. */
const BLOOM_FROM = 0.2;

/**
 * The source pulls the side hairlines in during the contraction; the live
 * reference (reference-reads-services.jpg) keeps them at full length through
 * Services. We follow the live site.
 */
const SIDE_LINES_RETRACT = false;

export type RingState = { opacity: number; scale: number };

export type CircleFrame = {
  /** Anything to draw at all. */
  visible: boolean;
  /** Outer-ring diameter, % of the viewport width. */
  width: number;
  /** Outer ring, crosshairs and side lines, moving as one. */
  outer: RingState;
  middle: RingState;
  inner: RingState;
  /** Side hairlines' length, 0..1. */
  lines: number;
  /** The two small side circles. `draw` is how much of each is stroked, 0..1. */
  side: { opacity: number; draw: number };
};

const HIDDEN: CircleFrame = {
  visible: false,
  width: CIRCLE_WIDTH.about,
  outer: { opacity: 0, scale: BLOOM_FROM },
  middle: { opacity: 0, scale: BLOOM_FROM },
  inner: { opacity: 0, scale: BLOOM_FROM },
  lines: 0,
  side: { opacity: 0, draw: 0 },
};

const within = (clock: number, [start, end]: Window) => clamp01((clock - start) / (end - start));

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t));
const easeInExpo = (t: number) => (t <= 0 ? 0 : 2 ** (10 * (t - 1)));

// A CSS-style cubic-bezier as a function, solved for x by bisection. The
// contraction and the exit ride the same curves as the reference's vignette.
function bezier(x1: number, y1: number, x2: number, y2: number) {
  const at = (a: number, b: number, t: number) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    let t = x;
    for (let i = 0; i < 28; i++) {
      const dx = at(x1, x2, t) - x;
      if (Math.abs(dx) < 1e-5) break;
      if (dx < 0) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return at(y1, y2, t);
  };
}

const contractEase = bezier(0.5, 0, 0.45, 0.94);
const exitEase = bezier(0.23, 1, 0.32, 1);

function ring(clock: number, out: Window, reducedMotion: boolean): RingState {
  const grown = easeOutCubic(within(clock, BEAT.bloom));
  const gone = easeInOutCubic(within(clock, out));
  return {
    opacity: grown * (1 - gone),
    scale: reducedMotion ? 1 : BLOOM_FROM + (1 - BLOOM_FROM) * grown,
  };
}

/** Everything the overlay shows at a point in the stage. */
export function circleFrameAt(step: number, value: number, reducedMotion = false): CircleFrame {
  const clock = sceneClock(step, value);
  if (clock < LIVE[0] || clock > LIVE[1]) return HIDDEN;

  const contracted = contractEase(within(clock, BEAT.contract));
  const exit = within(clock, BEAT.exit);

  let width = CIRCLE_WIDTH.about + (CIRCLE_WIDTH.reads - CIRCLE_WIDTH.about) * contracted;
  if (!reducedMotion && exit > 0) {
    width = CIRCLE_WIDTH.reads + (CIRCLE_WIDTH.exit - CIRCLE_WIDTH.reads) * exitEase(exit);
  }
  const outerOut = reducedMotion ? BEAT.exitInPlace : BEAT.exit;
  const inPlaceFade = reducedMotion ? 1 - easeInOutCubic(within(clock, BEAT.exitInPlace)) : 1;

  const drawn = within(clock, BEAT.sideIn);
  const sideOpacity = easeOutExpo(drawn) * (1 - easeInExpo(within(clock, BEAT.sideOut)));

  return {
    visible: true,
    width,
    outer: ring(clock, outerOut, reducedMotion),
    middle: ring(clock, BEAT.middleOut, reducedMotion),
    inner: ring(clock, BEAT.innerOut, reducedMotion),
    lines: SIDE_LINES_RETRACT ? 1 - easeInOutCubic(within(clock, BEAT.contract)) : 1,
    side: {
      opacity: sideOpacity * inPlaceFade,
      draw: reducedMotion ? (drawn > 0 ? 1 : 0) : drawn,
    },
  };
}

/**
 * Where the side circles sit for a given outer-ring width: centres in % of the
 * viewport width, always at 50% of its height. At the reads rest (width 48)
 * this is 14 and 86, each circle 24vw across.
 */
export function sideCircleCentres(width: number) {
  const offset = width * 0.75;
  return { left: 50 - offset, right: 50 + offset, top: 50, diameter: width / 2 };
}

/** The side circles while the reads section holds: the hotspots' positions. */
export const SIDE_CIRCLES_AT_REST = sideCircleCentres(CIRCLE_WIDTH.reads);
