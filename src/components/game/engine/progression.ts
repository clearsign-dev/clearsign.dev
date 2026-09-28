// Difficulty over a run. One step is one beat of the playing track, counted at
// the spawn horizon, so a faster track climbs faster.

export interface Stage {
  readonly index: number;
  readonly name: string;
  readonly fromStep: number;
  readonly speedMul: number;
  readonly windowScale: number;
  readonly scoreMul: number;
  /** 0..1; the chart plays density × NOTES_PER_MINUTE_PER_DENSITY notes a minute. */
  readonly density: number;
  readonly chords: boolean;
  readonly holds: boolean;
  /** Steps at the start of the stage over which the axes ease in. */
  readonly easeSteps: number;
}

export interface Axes {
  readonly stage: Stage;
  readonly speedMul: number;
  readonly windowScale: number;
  readonly scoreMul: number;
  readonly density: number;
  /** 0..1 toward the next stage (1 on the final plateau). */
  readonly progress: number;
}

export const NOTES_PER_MINUTE_PER_DENSITY = 110;
export const WARMUP_STEPS = 16;
export const WARMUP_DENSITY = 0.12;

const BASE_STAGES: readonly Stage[] = [
  { index: 0, name: "Nibble", fromStep: 0, speedMul: 1, windowScale: 1, scoreMul: 1, density: 0.18, chords: false, holds: false, easeSteps: 0 },
  { index: 1, name: "Byte", fromStep: 56, speedMul: 1.1, windowScale: 0.94, scoreMul: 1.2, density: 0.34, chords: true, holds: true, easeSteps: 16 },
  { index: 2, name: "Word", fromStep: 120, speedMul: 1.22, windowScale: 0.85, scoreMul: 1.5, density: 0.5, chords: true, holds: true, easeSteps: 16 },
  { index: 3, name: "Block", fromStep: 216, speedMul: 1.36, windowScale: 0.76, scoreMul: 1.85, density: 0.66, chords: true, holds: true, easeSteps: 16 },
  { index: 4, name: "Chain", fromStep: 344, speedMul: 1.5, windowScale: 0.7, scoreMul: 2.25, density: 0.78, chords: true, holds: true, easeSteps: 16 },
];

// Past the last named stage, every SUB_SPAN steps is a numbered sub-stage that
// walks the axes toward CEILING over PLATEAU_AFTER sub-stages, then holds.
const SUB_SPAN = 256;
const PLATEAU_AFTER = 4;
const CEILING = { speedMul: 1.85, windowScale: 0.62, density: 0.86 };
const SUB_SCORE_STEP = 0.3;
const NUMERALS = ["II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (x: number) => {
  const t = x <= 0 ? 0 : x >= 1 ? 1 : x;
  return t * t * (3 - 2 * t);
};

export const FIRST_STAGE = BASE_STAGES[0];
const LAST = BASE_STAGES[BASE_STAGES.length - 1];

export function stageForStep(step: number): Stage {
  if (step < LAST.fromStep) {
    for (let i = BASE_STAGES.length - 2; i >= 0; i--) {
      if (step >= BASE_STAGES[i].fromStep) return BASE_STAGES[i];
    }
    return FIRST_STAGE;
  }
  const sub = Math.floor((step - LAST.fromStep) / SUB_SPAN);
  if (sub <= 0) return LAST;
  const t = Math.min(1, sub / PLATEAU_AFTER);
  return {
    ...LAST,
    index: LAST.index + sub,
    name: `${LAST.name} ${NUMERALS[Math.min(sub - 1, NUMERALS.length - 1)]}`,
    fromStep: LAST.fromStep + sub * SUB_SPAN,
    speedMul: lerp(LAST.speedMul, CEILING.speedMul, t),
    windowScale: lerp(LAST.windowScale, CEILING.windowScale, t),
    density: lerp(LAST.density, CEILING.density, t),
    scoreMul: LAST.scoreMul + SUB_SCORE_STEP * sub,
  };
}

export function axesForStep(step: number): Axes {
  const stage = stageForStep(step);
  const into = Math.max(0, step - stage.fromStep);

  let { speedMul, windowScale, scoreMul } = stage;
  if (stage.easeSteps > 0 && stage.fromStep > 0 && into < stage.easeSteps) {
    const prev = stageForStep(stage.fromStep - 1);
    const t = smooth(into / stage.easeSteps);
    speedMul = lerp(prev.speedMul, stage.speedMul, t);
    windowScale = lerp(prev.windowScale, stage.windowScale, t);
    scoreMul = lerp(prev.scoreMul, stage.scoreMul, t);
  }

  // Sub-stages keep arriving (and keep raising the score multiplier) after the
  // axes plateau, so the bar always measures the way to the next one.
  const span =
    stage.index < LAST.index
      ? BASE_STAGES[stage.index + 1].fromStep - stage.fromStep
      : SUB_SPAN;
  const progress = into / span;

  return {
    stage,
    speedMul,
    windowScale,
    scoreMul,
    density: stage.density,
    progress: Math.max(0, Math.min(1, progress)),
  };
}
