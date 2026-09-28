// Quality tiers, chosen once from the device and refined by a GPU probe while
// the preloader is still up, then demoted at runtime by a frame-pacing
// governor. Same shape as the reference's GraphicsConfig + FramePacingGovernor:
// demote-only, because promotion oscillates on thermally throttled GPUs.

export type Tier = "high" | "medium" | "low";

export type TierConfig = {
  /** Point budget; the mark's lattice spacing is solved from it. */
  points: number;
  /** Device-pixel-ratio ceiling. */
  dprCap: number;
  /** Drawing-buffer pixel ceiling (the reference's maxResolution). */
  maxPixels: number;
  /** Cells in the pointer velocity field. */
  fieldCells: number;
};

export const TIERS: Record<Tier, TierConfig> = {
  high: { points: 64000, dprCap: 1.5, maxPixels: 2560 * 1440, fieldCells: 2200 },
  medium: { points: 42000, dprCap: 1.5, maxPixels: 1920 * 1080, fieldCells: 1800 },
  low: { points: 15000, dprCap: 1.5, maxPixels: 1600 * 1000, fieldCells: 1000 },
};

/** A clear high tier (fast probe on a dense display) renders at up to DPR 2. */
export const CLEAR_HIGH = { dprCap: 2, maxPixels: 3840 * 2160, probeMs: 4.5 } as const;

/** Render-scale steps the probe and governor walk down. Step 2 also cheapens the fill. */
export const RENDER_SCALE_STEPS = [1, 0.8, 0.65] as const;

/** Probe thresholds, median milliseconds per synced heavy frame. */
export const PROBE_LIMITS = { step1: 12, step2: 22 } as const;

type NavigatorHints = Navigator & { deviceMemory?: number };

export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

export function pickTier(): Tier {
  if (typeof window === "undefined") return "medium";
  if (isTouchDevice()) return "low";
  const nav = navigator as NavigatorHints;
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 8;
  return cores >= 8 && memory >= 8 ? "high" : "medium";
}

/** Median of the samples after dropping the first `skip` (warm-up) ones. */
export function median(samples: number[], skip = 0): number {
  const kept = samples.slice(skip).sort((a, b) => a - b);
  if (kept.length === 0) return 0;
  return kept[Math.floor(kept.length / 2)];
}

export function probeStep(medianMs: number): number {
  if (medianMs > PROBE_LIMITS.step2) return 2;
  if (medianMs > PROBE_LIMITS.step1) return 1;
  return 0;
}

/**
 * Samples rendered-frame deltas and fires `onDemote` when the p95 frame time
 * stays over budget. Pure measurement; the engine owns the quality actions.
 */
export class FramePacingGovernor {
  private static readonly OUTLIER_MS = 250;
  private static readonly WINDOW = 120;
  private static readonly EVALUATE_EVERY_MS = 2000;
  private static readonly COOLDOWN_MS = 4000;
  private static readonly P95_BUDGET_MS = 33;

  private readonly samples: number[] = [];
  private index = 0;
  private lastEvaluate = 0;
  private lastDemote = 0;
  private steps: number;

  constructor(
    private readonly onDemote: (step: number) => void,
    startStep = 0,
    private readonly maxStep = RENDER_SCALE_STEPS.length - 1,
  ) {
    this.steps = startStep;
  }

  record(deltaMs: number, now: number): void {
    if (this.steps >= this.maxStep) return;
    if (deltaMs <= 0 || deltaMs > FramePacingGovernor.OUTLIER_MS) return;
    if (this.samples.length < FramePacingGovernor.WINDOW) {
      this.samples.push(deltaMs);
    } else {
      this.samples[this.index] = deltaMs;
      this.index = (this.index + 1) % FramePacingGovernor.WINDOW;
    }
    if (now - this.lastEvaluate < FramePacingGovernor.EVALUATE_EVERY_MS) return;
    this.lastEvaluate = now;
    if (this.samples.length < FramePacingGovernor.WINDOW) return;
    if (now - this.lastDemote < FramePacingGovernor.COOLDOWN_MS) return;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.round((sorted.length - 1) * 0.95))];
    if (p95 <= FramePacingGovernor.P95_BUDGET_MS) return;
    this.steps += 1;
    this.lastDemote = now;
    // The demotion changes pacing: judge the next step on fresh frames only.
    this.samples.length = 0;
    this.index = 0;
    this.onDemote(this.steps);
  }

  /** Forget the window, e.g. after the tab was hidden. */
  reset(): void {
    this.samples.length = 0;
    this.index = 0;
  }
}
