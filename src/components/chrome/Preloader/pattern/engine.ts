import { counterTarget, stepCounter } from "../progress";
import type { PatternTokens, Rgb } from "./protocol";

// The preloader's grid: rows of small cells lit from the top of the screen,
// an accent layer that climbs the rows as loading advances and then stays
// lit behind the gate, a pointer trail, and the loading bar along the bottom
// edge. It also owns the counter's value, so the number on screen and the bar
// always agree.
//
// Runs unchanged in a worker (OffscreenCanvas) or on the main thread
// (HTMLCanvasElement): it touches no DOM, no store and no events; the host
// drives it through the returned API.

type Surface = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Layer = { surface: Surface; ctx: Ctx };

export type PatternEngineOptions = {
  canvas: Surface;
  dpr: number;
  reducedMotion: boolean;
  tokens: PatternTokens;
  /** Counter value to resume from (after a worker fallback). */
  startFrom?: number;
  /** Called with the counter's whole-number value each time it changes. */
  onProgress: (value: number) => void;
};

export type PatternEngine = {
  /** False when no 2D context was available: the counter still runs, nothing is drawn. */
  canDraw: boolean;
  resize: (width: number, height: number) => void;
  setTarget: (value: number, ready: boolean) => void;
  pointer: (x: number, y: number) => void;
  setActive: (active: boolean) => void;
  start: () => void;
  dispose: () => void;
};

// Cell geometry, CSS px.
const CELL_W = 18;
const CELL_H = 10;
const CELL_RADIUS = 1.5;
const PITCH_X = CELL_W + 8;
const PITCH_Y = CELL_H + 8;

// The lit region runs from the top edge down to this share of the height,
// fading with a slight curve so the top rows carry the light.
const LIT_AREA = 0.68;
const LIT_CURVE = 1.45;
const GRID_ALPHA = 0.88;

// Accent layer.
const ACCENT_ALPHA = 0.84;
const DEPTH_MIN = 0.42;
const NOISE_SCALE_X = 8;
const NOISE_SCALE_Y = 2.5;
const NOISE_OCTAVES = 4;
const NOISE_CONTRAST = 1.6;
const NOISE_WEIGHT = 0.4;

// The rising edge that reveals the accent layer.
const EDGE_SOFTNESS = 136;
const EDGE_LAG_MS = 340;
const EDGE_MAX_SPEED = 760; // px per second

// Pointer trail.
const TRAIL_RADIUS = 72;
const TRAIL_DECAY_MS = 460;
const TRAIL_MAX_ALPHA = 0.3;

const BAR_HEIGHT = 2;
const BAR_BLUR = 10;

const REDUCED_FADE_MS = 400;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (v: number) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const easeInOutSine = (v: number) => (1 - Math.cos(Math.PI * clamp01(v))) / 2;
const rgba = (c: Rgb, a: number) => `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
const mixRgb = (a: Rgb, b: Rgb, t: number): Rgb => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

// Value noise: a hashed lattice, smoothly interpolated, summed over octaves.
function lattice(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = smooth(x - xi);
  const v = smooth(y - yi);
  const top = lattice(xi, yi) + (lattice(xi + 1, yi) - lattice(xi, yi)) * u;
  const bottom = lattice(xi, yi + 1) + (lattice(xi + 1, yi + 1) - lattice(xi, yi + 1)) * u;
  return top + (bottom - top) * v;
}

function layeredNoise(x: number, y: number): number {
  let sum = 0;
  let weight = 0;
  let amplitude = 1;
  let frequency = 1;
  for (let i = 0; i < NOISE_OCTAVES; i++) {
    sum += valueNoise(x * frequency, y * frequency) * amplitude;
    weight += amplitude;
    amplitude /= 2;
    frequency *= 2;
  }
  return clamp01((sum / weight - 0.5) * NOISE_CONTRAST + 0.5);
}

function litAmount(centerY: number, areaBottom: number): number {
  return Math.pow(clamp01(1 - centerY / Math.max(areaBottom, 1)), LIT_CURVE);
}

function createSurface(width: number, height: number): Surface | null {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function context2d(surface: Surface): Ctx | null {
  return (surface as OffscreenCanvas).getContext("2d") as Ctx | null;
}

function cellPath(ctx: Ctx, inset: number) {
  const w = CELL_W - inset * 2;
  const h = CELL_H - inset * 2;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(inset, inset, w, h, CELL_RADIUS);
  else ctx.rect(inset, inset, w, h);
}

// Workers may lack requestAnimationFrame; a timer keeps the loop alive there.
const requestFrame: (cb: (now: number) => void) => number =
  typeof requestAnimationFrame === "function"
    ? (cb) => requestAnimationFrame(cb)
    : (cb) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
const cancelFrame: (id: number) => void =
  typeof cancelAnimationFrame === "function" ? (id) => cancelAnimationFrame(id) : (id) => clearTimeout(id);

type Phase = "loading" | "fading" | "held";

export function createPatternEngine(options: PatternEngineOptions): PatternEngine {
  const { canvas, dpr, reducedMotion, tokens, onProgress } = options;
  const ctx = context2d(canvas);

  const litStroke = mixRgb(tokens.accent, tokens.ink, 0.45);
  const highlight = mixRgb(tokens.ink, tokens.accent, 0.18);

  let width = 1;
  let height = 1;
  let sprites: { base: Surface; accent: Surface; highlight: Surface } | null = null;
  let base: Layer | null = null;
  let accent: Layer | null = null;
  // Per-frame masking buffer while loading; once lit, it holds the final picture.
  let scratch: Layer | null = null;

  let phase: Phase = "loading";
  let fadeStartedAt = 0;
  let target = 0;
  let ready = false;
  let value = Math.max(0, Math.min(100, options.startFrom ?? 0));
  let reported = -1;
  let edgeY = Number.NaN;

  let frame = 0;
  let last = 0;
  let running = false;
  let disposed = false;
  let active = true;

  const trail = new Map<number, { x: number; y: number; i: number }>();
  let cols = 0;
  let rows = 0;
  let pointerX = 0;
  let pointerY = 0;
  let stampX = 0;
  let stampY = 0;
  let pointerSeen = false;
  let pointerMoved = false;
  let trailDirty = false;

  const areaBottom = () => height * LIT_AREA;

  const makeLayer = (): Layer | null => {
    const surface = createSurface(Math.max(1, Math.floor(width * dpr)), Math.max(1, Math.floor(height * dpr)));
    const layerCtx = surface ? context2d(surface) : null;
    if (!surface || !layerCtx) return null;
    layerCtx.scale(dpr, dpr);
    return { surface, ctx: layerCtx };
  };

  const makeSprite = (paint: (c: Ctx) => void): Surface | null => {
    const surface = createSurface(Math.ceil(CELL_W * dpr), Math.ceil(CELL_H * dpr));
    const spriteCtx = surface ? context2d(surface) : null;
    if (!surface || !spriteCtx) return null;
    spriteCtx.scale(dpr, dpr);
    paint(spriteCtx);
    return surface;
  };

  const buildSprites = () => {
    const baseSprite = makeSprite((c) => {
      cellPath(c, 0.5);
      c.fillStyle = rgba(tokens.ink, 0.025);
      c.fill();
      c.lineWidth = 1;
      c.strokeStyle = rgba(tokens.ink, 0.18);
      c.stroke();
    });
    const accentSprite = makeSprite((c) => {
      const gradient = c.createLinearGradient(0, 0, 0, CELL_H);
      gradient.addColorStop(0, rgba(tokens.accent, 0.22));
      gradient.addColorStop(1, rgba(tokens.accent, 0.6));
      cellPath(c, 1);
      c.fillStyle = gradient;
      c.fill();
      cellPath(c, 0.5);
      c.lineWidth = 1;
      c.strokeStyle = rgba(litStroke, 0.26);
      c.stroke();
    });
    const highlightSprite = makeSprite((c) => {
      cellPath(c, 0.5);
      c.fillStyle = rgba(highlight, 0.16);
      c.fill();
      c.lineWidth = 1;
      c.strokeStyle = rgba(highlight, 0.85);
      c.stroke();
    });
    sprites =
      baseSprite && accentSprite && highlightSprite
        ? { base: baseSprite, accent: accentSprite, highlight: highlightSprite }
        : null;
  };

  // A soft light from above: two broad ellipses of ink over the ground.
  const paintWash = (c: Ctx) => {
    const ellipses: [number, number, number, number, number][] = [
      [0.5, 0.3, 0.52, 0.5, 0.04],
      [0.5, 0.44, 0.96, 0.88, 0.025],
    ];
    for (const [cx, cy, rx, ry, alpha] of ellipses) {
      c.save();
      c.translate(width * cx, height * cy);
      c.scale(width * rx, height * ry);
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 1);
      g.addColorStop(0, rgba(tokens.ink, alpha));
      g.addColorStop(0.7, rgba(tokens.ink, alpha * 0.34));
      g.addColorStop(1, rgba(tokens.ink, 0));
      c.fillStyle = g;
      c.fillRect(-1, -1, 2, 2);
      c.restore();
    }
  };

  const bakeLit = () => {
    if (!scratch || !base || !accent) return;
    const c = scratch.ctx;
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    c.clearRect(0, 0, width, height);
    c.drawImage(base.surface, 0, 0, width, height);
    c.drawImage(accent.surface, 0, 0, width, height);
    // The final picture lives in scratch now; the source layers can go.
    base = null;
    accent = null;
  };

  const buildLayers = () => {
    if (!sprites) return;
    base = makeLayer();
    accent = makeLayer();
    scratch = makeLayer();
    if (!base || !accent || !scratch) {
      base = accent = scratch = null;
      return;
    }

    base.ctx.fillStyle = rgba(tokens.ground, 1);
    base.ctx.fillRect(0, 0, width, height);
    paintWash(base.ctx);

    const bottom = areaBottom();
    cols = Math.ceil(width / PITCH_X) + 2;
    rows = Math.ceil(height / PITCH_Y) + 2;
    trail.clear();

    for (let row = 0; row < rows; row++) {
      const y = row * PITCH_Y;
      const lit = litAmount(y + CELL_H / 2, bottom);
      if (lit <= 0.002) continue;
      for (let col = 0; col < cols; col++) {
        const x = col * PITCH_X;
        base.ctx.globalAlpha = GRID_ALPHA * lit;
        base.ctx.drawImage(sprites.base, x, y, CELL_W, CELL_H);

        const n = layeredNoise(
          ((x + CELL_W / 2) / Math.max(width, 1)) * NOISE_SCALE_X,
          ((y + CELL_H / 2) / Math.max(bottom, 1)) * NOISE_SCALE_Y,
        );
        const depth = DEPTH_MIN + Math.random() * (1 - DEPTH_MIN);
        accent.ctx.globalAlpha = Math.min(1, lit * depth * ACCENT_ALPHA * (1 - NOISE_WEIGHT + NOISE_WEIGHT * n));
        accent.ctx.drawImage(sprites.accent, x, y, CELL_W, CELL_H);
      }
    }
    base.ctx.globalAlpha = 1;
    accent.ctx.globalAlpha = 1;

    if (phase === "held") bakeLit();
  };

  // --- Pointer trail -------------------------------------------------------

  const stamp = (px: number, py: number) => {
    const bottom = areaBottom();
    const col0 = Math.max(0, Math.floor((px - TRAIL_RADIUS) / PITCH_X));
    const col1 = Math.min(cols - 1, Math.ceil((px + TRAIL_RADIUS) / PITCH_X));
    const row0 = Math.max(0, Math.floor((py - TRAIL_RADIUS) / PITCH_Y));
    const row1 = Math.min(rows - 1, Math.ceil((py + TRAIL_RADIUS) / PITCH_Y));
    for (let row = row0; row <= row1; row++) {
      const y = row * PITCH_Y;
      const lit = litAmount(y + CELL_H / 2, bottom);
      if (lit <= 0.01) continue;
      for (let col = col0; col <= col1; col++) {
        const x = col * PITCH_X;
        const distance = Math.hypot(x + CELL_W / 2 - px, y + CELL_H / 2 - py);
        if (distance > TRAIL_RADIUS) continue;
        const strength = smooth(1 - distance / TRAIL_RADIUS) * lit;
        if (strength < 0.01) continue;
        const key = row * cols + col;
        const cell = trail.get(key);
        if (cell) cell.i = Math.max(cell.i, strength);
        else trail.set(key, { x, y, i: strength });
      }
    }
  };

  const updateTrail = (dt: number) => {
    if (trail.size) {
      const keep = Math.exp(-dt / TRAIL_DECAY_MS);
      for (const [key, cell] of trail) {
        cell.i *= keep;
        if (cell.i < 0.01) trail.delete(key);
      }
    }
    if (pointerMoved) {
      pointerMoved = false;
      const steps = Math.max(1, Math.ceil(Math.hypot(pointerX - stampX, pointerY - stampY) / (PITCH_X / 2)));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        stamp(stampX + (pointerX - stampX) * t, stampY + (pointerY - stampY) * t);
      }
      stampX = pointerX;
      stampY = pointerY;
    }
  };

  const drawTrail = (c: Ctx) => {
    if (!sprites || !trail.size) return;
    for (const cell of trail.values()) {
      const alpha = cell.i * TRAIL_MAX_ALPHA;
      if (alpha <= 0.003) continue;
      c.globalAlpha = alpha;
      c.drawImage(sprites.highlight, cell.x, cell.y, CELL_W, CELL_H);
    }
    c.globalAlpha = 1;
  };

  // --- Frame composition ---------------------------------------------------

  const edgeTarget = () => {
    const bottom = areaBottom();
    return bottom - (bottom + EDGE_SOFTNESS / 2) * easeInOutSine(value / 100);
  };

  // Accent shows below the edge and fades out across a soft band above it.
  const drawMaskedAccent = (c: Ctx, edge: number) => {
    if (!accent || !scratch) return;
    const m = scratch.ctx;
    m.globalCompositeOperation = "source-over";
    m.globalAlpha = 1;
    m.clearRect(0, 0, width, height);
    m.drawImage(accent.surface, 0, 0, width, height);
    m.globalCompositeOperation = "destination-in";
    const softness = Math.max(EDGE_SOFTNESS, PITCH_Y * 3.4);
    const from = edge - softness / 2;
    const mask = m.createLinearGradient(0, 0, 0, height);
    mask.addColorStop(0, "rgba(0, 0, 0, 0)");
    for (let k = 0; k <= 4; k++) {
      const t = k / 4;
      mask.addColorStop(clamp01((from + softness * t) / height), `rgba(0, 0, 0, ${smooth(t)})`);
    }
    mask.addColorStop(1, "rgba(0, 0, 0, 1)");
    m.fillStyle = mask;
    m.fillRect(0, 0, width, height);
    m.globalCompositeOperation = "source-over";
    c.drawImage(scratch.surface, 0, 0, width, height);
  };

  const drawBar = (c: Ctx) => {
    const barWidth = clamp01(value / 100) * width;
    const alpha = 1 - clamp01(value - 99);
    if (barWidth <= 0 || alpha <= 0.001) return;
    c.save();
    c.globalAlpha = alpha;
    c.shadowColor = rgba(tokens.accent, 0.5);
    c.shadowBlur = BAR_BLUR * dpr;
    c.fillStyle = rgba(tokens.accent, 1);
    c.fillRect(0, height - BAR_HEIGHT, barWidth, BAR_HEIGHT);
    c.restore();
  };

  const render = (now: number) => {
    if (!ctx) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    if (phase === "held") {
      if (scratch) ctx.drawImage(scratch.surface, 0, 0, width, height);
    } else {
      if (base) ctx.drawImage(base.surface, 0, 0, width, height);
      if (phase === "fading" && accent) {
        ctx.globalAlpha = clamp01((now - fadeStartedAt) / REDUCED_FADE_MS);
        ctx.drawImage(accent.surface, 0, 0, width, height);
        ctx.globalAlpha = 1;
      } else if (!reducedMotion) {
        drawMaskedAccent(ctx, Number.isNaN(edgeY) ? areaBottom() : edgeY);
      }
    }
    drawTrail(ctx);
    drawBar(ctx);
  };

  const reportValue = () => {
    const whole = Math.floor(value);
    if (whole !== reported) {
      reported = whole;
      onProgress(whole);
    }
  };

  const tick = (now: number) => {
    if (disposed) return;
    frame = requestFrame(tick);
    const dt = Math.max(0, now - last);
    last = now;
    if (!active) return;

    if (phase === "held") {
      // Only the trail moves now; draw while it has something to show, plus
      // one frame to clear it.
      if (reducedMotion) return;
      updateTrail(dt);
      if (trail.size || trailDirty) {
        trailDirty = trail.size > 0;
        render(now);
      }
      return;
    }

    value = stepCounter(value, counterTarget(target, ready), dt);
    reportValue();

    if (phase === "loading") {
      const goal = edgeTarget();
      if (Number.isNaN(edgeY)) edgeY = goal;
      else {
        const wanted = (goal - edgeY) * (1 - Math.exp(-Math.min(dt, 64) / EDGE_LAG_MS));
        const limit = (EDGE_MAX_SPEED * Math.min(dt, 64)) / 1000;
        edgeY += Math.sign(wanted) * Math.min(Math.abs(wanted), limit);
      }
      if (value >= 100) {
        if (reducedMotion) {
          phase = "fading";
          fadeStartedAt = now;
        } else if (Math.abs(goal - edgeY) <= PITCH_Y / 4) {
          phase = "held";
          bakeLit();
        }
      }
    } else if (phase === "fading" && now - fadeStartedAt >= REDUCED_FADE_MS) {
      phase = "held";
      bakeLit();
    }

    if (!reducedMotion) updateTrail(dt);
    render(now);
  };

  buildSprites();
  reportValue();

  return {
    canDraw: !!ctx && !!sprites,
    resize(nextWidth, nextHeight) {
      width = Math.max(1, Math.round(nextWidth));
      height = Math.max(1, Math.round(nextHeight));
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
      buildLayers();
      edgeY = Number.NaN;
      render(performance.now());
    },
    setTarget(nextTarget, nextReady) {
      target = Math.max(0, Math.min(100, nextTarget));
      ready = nextReady;
    },
    pointer(x, y) {
      if (reducedMotion) return;
      pointerX = x;
      pointerY = y;
      if (!pointerSeen) {
        pointerSeen = true;
        stampX = x;
        stampY = y;
      }
      pointerMoved = true;
    },
    setActive(next) {
      active = next;
    },
    start() {
      if (running || disposed) return;
      running = true;
      last = performance.now();
      frame = requestFrame(tick);
    },
    dispose() {
      disposed = true;
      cancelFrame(frame);
      trail.clear();
      sprites = null;
      base = accent = scratch = null;
    },
  };
}
