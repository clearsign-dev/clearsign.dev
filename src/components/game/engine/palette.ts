// Canvas colours come from the brand tokens in globals.css, read once when the
// game mounts. Nothing here is a brand value of its own.

export type RGB = readonly [number, number, number];

export interface Palette {
  accent: RGB;
  accentDeep: RGB;
  onAccent: RGB;
  ink: RGB;
  text: RGB;
  grey100: RGB;
  grey300: RGB;
  grey400: RGB;
  dark: RGB;
  ground: RGB;
  critical: RGB;
  blind: RGB;
  fontMono: string;
  fontDisplay: string;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Accepts #rgb, #rrggbb(aa), rgb()/rgba() and bare "r g b" triplets. */
export function parseColor(raw: string): RGB | null {
  const value = raw.trim();
  if (!value) return null;

  if (value.startsWith("#")) {
    let hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .slice(0, 3)
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (hex.length !== 6 && hex.length !== 8) return null;
    const n = Number.parseInt(hex.slice(0, 6), 16);
    if (Number.isNaN(n)) return null;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  const fn = /^rgba?\((.*)\)$/i.exec(value);
  const body = fn ? fn[1] : value;
  const parts = body
    .split(/[\s,/]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map(Number);
  if (parts.length === 3 && parts.every((p) => Number.isFinite(p))) {
    return [clampByte(parts[0]), clampByte(parts[1]), clampByte(parts[2])];
  }
  return null;
}

export function readPalette(el: Element = document.documentElement): Palette {
  const style = getComputedStyle(el);
  const token = (name: string) => style.getPropertyValue(name);
  const ink = parseColor(token("--ink")) ?? parseColor(style.color) ?? [224, 224, 224];
  const pick = (name: string, fallback: RGB = ink): RGB => parseColor(token(name)) ?? fallback;

  const accent = parseColor(token("--accent")) ?? parseColor(token("--accent-rgb")) ?? ink;
  const fontMono = token("--font-mono").trim() || "monospace";

  return {
    accent,
    accentDeep: pick("--accent-deep", accent),
    onAccent: pick("--on-accent", pick("--ground")),
    ink,
    text: pick("--text"),
    grey100: pick("--grey-100"),
    grey300: pick("--grey-300"),
    grey400: pick("--grey-400"),
    dark: pick("--dark"),
    ground: pick("--ground"),
    critical: pick("--sev-critical", accent),
    blind: pick("--sev-blind", accent),
    fontMono,
    fontDisplay: token("--font-display").trim() || fontMono,
  };
}

export function rgba(c: RGB, a: number): string {
  const alpha = a <= 0 ? 0 : a >= 1 ? 1 : a;
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha.toFixed(3)})`;
}

export function mix(a: RGB, b: RGB, t: number): RGB {
  const k = t <= 0 ? 0 : t >= 1 ? 1 : t;
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}
