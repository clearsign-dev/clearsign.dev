// Procedural fog for the full-screen transition. A dense front with a thin
// haze ahead of it crosses the screen from the bottom-left to the top-right;
// its edge billows with warped value noise that drifts along the sweep. It is
// drawn into a small canvas (about 26k pixels) and CSS-scaled to the viewport,
// so the upscale itself softens it. No textures are loaded.

export type SmokeStage = "covering" | "revealing";

type RGB = readonly [number, number, number];

type Palette = { ground: RGB; deep: RGB; body: RGB; mist: RGB; accent: RGB };

export type SmokeField = {
  /** Re-read the colour tokens, fit the viewport and pick a fresh seed. */
  prepare: () => void;
  /** Draw coverage `progress` (0 clear, 1 covered) at `seconds` since start. */
  render: (progress: number, stage: SmokeStage, seconds: number) => void;
  clear: () => void;
};

const PIXEL_BUDGET = 26000;
/** Noise cells per viewport height. */
const FREQUENCY = 2.2;
/** How far the front's edge can wander either side of a straight line (0..1 of the sweep). */
const BILLOW = 0.22;
/** Half-width of the dense front's soft edge. */
const SOFT = 0.1;
/** The haze runs this far ahead of the front. */
const HAZE_REACH = 0.3;
const HAZE_ALPHA = 0.55;
/** Sweep direction: mostly left-to-right, partly bottom-to-top. */
const SWEEP_X = 0.62;
const SWEEP_Y = 0.38;

const GREY: RGB = [40, 40, 44];
const BLACK: RGB = [0, 0, 0];

function parseColor(raw: string, fallback: RGB): RGB {
  const value = raw.trim();
  if (value.startsWith("#")) {
    let hex = value.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .slice(0, 3)
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const n = Number.parseInt(hex.slice(0, 6), 16);
    return hex.length >= 6 && !Number.isNaN(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : fallback;
  }
  const parts = value.match(/-?\d*\.?\d+/g);
  return parts && parts.length >= 3 ? [Number(parts[0]), Number(parts[1]), Number(parts[2])] : fallback;
}

function readPalette(): Palette {
  const styles = getComputedStyle(document.documentElement);
  const token = (name: string, fallback: RGB) => parseColor(styles.getPropertyValue(name), fallback);
  return {
    ground: token("--ground", BLACK),
    deep: token("--dark", GREY),
    body: token("--grey-400", GREY),
    mist: token("--grey-100", GREY),
    accent: token("--accent-rgb", GREY),
  };
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const smooth01 = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};

function hash(x: number, y: number, seed: number): number {
  let h = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ seed;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const u = fx * fx * (3 - 2 * fx);
  const v = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Octaves are rotated against each other so the lattice never lines up.
function fbm(x: number, y: number, octaves: number, seed: number): number {
  let sum = 0;
  let amplitude = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += amplitude * valueNoise(x, y, seed + o * 1013);
    norm += amplitude;
    const nx = (x * 0.8 - y * 0.6) * 2.07 + 3.7;
    y = (x * 0.6 + y * 0.8) * 2.07 + 1.3;
    x = nx;
    amplitude *= 0.5;
  }
  return sum / norm;
}

export function createSmokeField(canvas: HTMLCanvasElement): SmokeField | null {
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  let width = 0;
  let height = 0;
  let image: ImageData | null = null;
  let sweep = new Float32Array(0);
  let noiseX = new Float32Array(0);
  let noiseY = new Float32Array(0);
  let palette: Palette = { ground: BLACK, deep: GREY, body: GREY, mist: GREY, accent: GREY };
  let seed = 1;
  let offset = 0;

  const fit = () => {
    const vw = Math.max(1, window.innerWidth);
    const vh = Math.max(1, window.innerHeight);
    const aspect = vw / vh;
    const w = Math.max(24, Math.round(Math.sqrt(PIXEL_BUDGET * aspect)));
    const h = Math.max(24, Math.round(w / aspect));
    if (w === width && h === height && image) return;
    width = w;
    height = h;
    canvas.width = w;
    canvas.height = h;
    image = ctx.createImageData(w, h);
    const count = w * h;
    sweep = new Float32Array(count);
    noiseX = new Float32Array(count);
    noiseY = new Float32Array(count);
    for (let j = 0; j < h; j++) {
      const v = (j + 0.5) / h;
      for (let i = 0; i < w; i++) {
        const u = (i + 0.5) / w;
        const k = j * w + i;
        sweep[k] = SWEEP_X * u + SWEEP_Y * (1 - v);
        noiseX[k] = u * aspect * FREQUENCY;
        noiseY[k] = v * FREQUENCY;
      }
    }
  };

  const prepare = () => {
    palette = readPalette();
    seed = (Math.random() * 0x7fffffff) | 0;
    offset = Math.random() * 64;
    fit();
  };

  const render = (progress: number, stage: SmokeStage, seconds: number) => {
    if (!image) return;
    const data = image.data;
    const covering = stage === "covering";
    const reach = BILLOW + HAZE_REACH;
    // The front (covering) or trailing edge (revealing) along the sweep.
    const edge = -reach + (1 + 2 * reach) * (covering ? clamp01(progress) : 1 - clamp01(progress));
    const warpX = offset + seconds * 0.1;
    const warpY = -seconds * 0.06;
    const driftX = offset + seconds * 0.28;
    const driftY = -seconds * 0.16;
    const { ground, deep, body, mist, accent } = palette;

    for (let i = 0, k = 0; i < sweep.length; i++, k += 4) {
      const s = sweep[i];
      const highest = covering ? edge - s + BILLOW : s + BILLOW - edge;
      if (highest <= -HAZE_REACH) {
        data[k + 3] = 0;
        continue;
      }
      const x = noiseX[i];
      const y = noiseY[i];
      const q = fbm(x * 0.8 + warpX, y * 0.8 + warpY, 2, seed);
      const n = fbm(x + q * 1.5 + driftX, y + q * 1.2 + driftY, 3, seed + 7);
      const billow = Math.max(-1, Math.min(1, (n - 0.5) * 2.6)) * BILLOW;
      const arg = covering ? edge - s - billow : s + billow - edge;
      const dense = smooth01((arg + SOFT) / (2 * SOFT));
      const haze = smooth01((arg + HAZE_REACH) / (HAZE_REACH + SOFT)) * HAZE_ALPHA;
      const alpha = dense > haze ? dense : haze;
      if (alpha < 0.004) {
        data[k + 3] = 0;
        continue;
      }
      // Body: ground → deep → body by density; the front's edge catches mist
      // on thick parts and a faint accent glow on thin ones.
      const shade = smooth01((n - 0.28) / 0.5);
      const low = shade < 0.5 ? shade * 2 : 1;
      const high = shade > 0.5 ? shade * 2 - 1 : 0;
      const glow = 4 * dense * (1 - dense);
      const lit = glow * 0.34 * shade + high * 0.12;
      const tint = glow * 0.22 * (1 - shade);
      data[k] = ground[0] + (deep[0] - ground[0]) * low + (body[0] - deep[0]) * high + mist[0] * lit + accent[0] * tint;
      data[k + 1] = ground[1] + (deep[1] - ground[1]) * low + (body[1] - deep[1]) * high + mist[1] * lit + accent[1] * tint;
      data[k + 2] = ground[2] + (deep[2] - ground[2]) * low + (body[2] - deep[2]) * high + mist[2] * lit + accent[2] * tint;
      data[k + 3] = alpha * 255;
    }
    ctx.putImageData(image, 0, 0);
  };

  const clear = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return { prepare, render, clear };
}
