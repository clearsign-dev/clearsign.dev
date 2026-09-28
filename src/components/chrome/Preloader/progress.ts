// The loading counter's pacing. The counter never outruns what has actually
// loaded, never moves faster than RATE_PER_SECOND, and parks one short of the
// end until the scene says it is ready.

export const RATE_PER_SECOND = 30;
export const HOLD_AT = 99;
/** A long frame (a stalled thread) is treated as this long, so the counter never leaps. */
export const MAX_FRAME_MS = 1000 / RATE_PER_SECOND;

export function counterTarget(target: number, ready: boolean): number {
  if (ready) return 100;
  return Math.min(HOLD_AT, Math.max(0, target));
}

/** One frame of travel toward `target`. Never goes backwards. */
export function stepCounter(current: number, target: number, frameMs: number): number {
  if (target <= current) return current;
  const ms = Math.min(Math.max(0, frameMs), MAX_FRAME_MS);
  return Math.min(target, current + (ms / 1000) * RATE_PER_SECOND);
}
