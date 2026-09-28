// The scene's colours come from the brand tokens in globals.css, read once when
// the scene starts. Shaders get them as sRGB floats; the whole pipeline stays in
// sRGB (no linear conversion), so a token renders as the colour it names.

export type RGB = [number, number, number];

export type SceneTokens = {
  ink: RGB;
  accent: RGB;
  accentDeep: RGB;
  ground: RGB;
};

// Neutral stand-ins used only if a token is missing or unparseable. Not brand
// values: a scene without its tokens should look grey, not wrong-coloured.
const NEUTRAL: SceneTokens = {
  ink: [0.92, 0.92, 0.92],
  accent: [0.5, 0.5, 0.5],
  accentDeep: [0.25, 0.25, 0.25],
  ground: [0, 0, 0],
};

function parseHex(hex: string): RGB | null {
  let h = hex.slice(1);
  if (h.length === 3 || h.length === 4) {
    h = h
      .slice(0, 3)
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (h.length !== 6 && h.length !== 8) return null;
  const n = Number.parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return null;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function parseRgbFunction(value: string): RGB | null {
  const match = value.match(/^rgba?\(([^)]+)\)$/i);
  if (!match) return null;
  const parts = match[1]
    .replace(/\//g, " ")
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 3);
  if (parts.length < 3) return null;
  const channels = parts.map((p) =>
    p.endsWith("%") ? (Number.parseFloat(p) / 100) * 255 : Number.parseFloat(p),
  );
  if (channels.some((c) => Number.isNaN(c))) return null;
  return channels.map((c) => Math.max(0, Math.min(255, c)) / 255) as RGB;
}

export function parseCssColor(input: string): RGB | null {
  const value = input.trim();
  if (!value) return null;
  if (value.startsWith("#")) return parseHex(value);
  return parseRgbFunction(value);
}

export function readTokens(): SceneTokens {
  if (typeof document === "undefined") return NEUTRAL;
  const style = getComputedStyle(document.documentElement);
  const read = (name: string, fallback: RGB): RGB =>
    parseCssColor(style.getPropertyValue(name)) ?? fallback;
  return {
    ink: read("--ink", NEUTRAL.ink),
    accent: read("--accent", NEUTRAL.accent),
    accentDeep: read("--accent-deep", NEUTRAL.accentDeep),
    ground: read("--ground", NEUTRAL.ground),
  };
}
