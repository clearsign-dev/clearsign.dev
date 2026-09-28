import type { PatternTokens, Rgb } from "./protocol";

// Canvas code cannot read CSS variables, so the host resolves the brand tokens
// once and hands the engine numbers. If a token is missing the grid falls
// back to neutral ink rather than to any hardcoded brand colour.

const NEUTRAL: Rgb = [255, 255, 255];
const UNLIT: Rgb = [0, 0, 0];

function parseColour(raw: string): Rgb | null {
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("#")) {
    let hex = value.slice(1);
    if (hex.length === 3) hex = hex.replace(/./g, (c) => c + c);
    if (hex.length !== 6 || /[^0-9a-f]/i.test(hex)) return null;
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  // "74 163 201", "74, 163, 201" or "rgb(74 163 201)"
  const parts = value
    .replace(/^rgba?\(/i, "")
    .replace(/\)$/, "")
    .split(/[\s,/]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(Number);
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) return null;
  return [parts[0], parts[1], parts[2]];
}

export function readPatternTokens(): PatternTokens {
  const style = getComputedStyle(document.documentElement);
  const ink = parseColour(style.getPropertyValue("--ink")) ?? NEUTRAL;
  const accent = parseColour(style.getPropertyValue("--accent-rgb")) ?? ink;
  const ground = parseColour(style.getPropertyValue("--ground")) ?? UNLIT;
  return { ground, accent, ink };
}
