// Scroll-scrubbed motion is expressed as progress curves: a section hands each
// component a 0..1 value, and components shape it with these.

export type Beat = Readonly<{ start: number; end: number }>;

export type RevealWindow = {
  revealStart?: number;
  revealEnd?: number;
  hideStart?: number;
  hideEnd?: number;
};

export const beat = (start: number, span: number): Beat => ({ start, end: start + span });

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function smoothstep(value: number): number {
  const x = clamp01(value);
  return x * x * (3 - 2 * x);
}

export function linearBeatProgress(progress: number, b: Beat): number {
  const end = Math.max(b.start, b.end);
  return clamp01((progress - b.start) / Math.max(end - b.start, Number.EPSILON));
}

export function beatProgress(progress: number, b: Beat): number {
  return smoothstep(linearBeatProgress(progress, b));
}

// A single-peak curve: rises through the reveal window, holds at 1, falls
// through the hide window. Section progress can run past 1 for an outgoing
// section (see the stage's holdover), which is what lets hideEnd exceed 1.
export function uiProgress(
  sectionProgress: number,
  { revealStart = 0, revealEnd = 0.36, hideStart = 0.72, hideEnd = 1 }: RevealWindow = {},
): number {
  const rs = Math.max(0, Math.min(revealStart, revealEnd));
  const re = Math.max(rs, revealEnd);
  const hs = Math.max(re, hideStart);
  const he = Math.max(hs, hideEnd);
  const p = Math.max(0, Math.min(sectionProgress, he));
  if (p <= rs) return 0;
  if (p <= re) return smoothstep((p - rs) / Math.max(re - rs, Number.EPSILON));
  if (p <= hs) return 1;
  if (p >= he) return 0;
  return 1 - smoothstep((p - hs) / Math.max(he - hs, Number.EPSILON));
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Frame-rate independent exponential smoothing toward a target.
export function damp(current: number, target: number, smoothingMs: number, dtMs: number): number {
  const alpha = 1 - Math.exp(-Math.min(Math.max(dtMs, 0), 64) / Math.max(smoothingMs, 1));
  const next = current + (target - current) * alpha;
  return Math.abs(target - next) < 0.0005 ? target : next;
}
