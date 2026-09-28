// Canvas 2D drawing of the highway: four lanes in perspective running down to
// the signing line, bytes on them, and the hit effects. Pure drawing; the
// simulation lives in game.ts.

import { LANE_COUNT, type LaneFx, type SceneState } from "./model";
import { mix, rgba, type Palette, type RGB } from "./palette";

export interface Layout {
  w: number;
  h: number;
  dpr: number;
  cx: number;
  hitY: number;
  farY: number;
  vanishY: number;
  /** Highway width at the signing line. */
  nearW: number;
  /** Perspective constant: scale at depth z is 1 / (1 + k·z). */
  k: number;
  /** How far the lanes run past the line toward the viewer. */
  zNear: number;
  compact: boolean;
}

const FAR_SCALE = 0.24;

export function computeLayout(w: number, h: number, dpr: number, compact: boolean): Layout {
  const hitY = h * (compact ? 0.74 : 0.76);
  const farY = h * (compact ? 0.2 : 0.14);
  const nearW = compact ? Math.min(w - 20, 520) : Math.max(340, Math.min(w * 0.44, 620));
  const k = 1 / FAR_SCALE - 1;
  const vanishY = (farY - hitY * FAR_SCALE) / (1 - FAR_SCALE);
  return { w, h, dpr, cx: w / 2, hitY, farY, vanishY, nearW, k, zNear: -0.035, compact };
}

export function depthScale(L: Layout, z: number): number {
  return 1 / (1 + L.k * z);
}

export function yAt(L: Layout, z: number): number {
  return L.vanishY + (L.hitY - L.vanishY) * depthScale(L, z);
}

export function laneWidthAt(L: Layout, z: number): number {
  return (L.nearW * depthScale(L, z)) / LANE_COUNT;
}

export function laneXAt(L: Layout, lane: number, z: number): number {
  return L.cx + (lane - (LANE_COUNT - 1) / 2) * laneWidthAt(L, z);
}

/** Pad size at the signing line. */
export function padSize(L: Layout): { w: number; h: number } {
  const lw = laneWidthAt(L, 0);
  return { w: lw * 0.74, h: lw * 0.3 };
}

/** Lane under a viewport point, using the lane edges at that point's depth. */
export function laneFromPoint(L: Layout, x: number, y: number): number {
  let scale = 1;
  if (y < L.hitY) {
    const p = (y - L.vanishY) / (L.hitY - L.vanishY);
    scale = Math.max(FAR_SCALE, Math.min(1, p));
  }
  const width = L.nearW * scale;
  const lane = Math.floor(((x - (L.cx - width / 2)) / width) * LANE_COUNT);
  return lane < 0 ? 0 : lane >= LANE_COUNT ? LANE_COUNT - 1 : lane;
}

const clamp01 = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v);
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);

function roundRectPath(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.arcTo(x + w, y, x + w, y + rr, rr);
  g.lineTo(x + w, y + h - rr);
  g.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  g.lineTo(x + rr, y + h);
  g.arcTo(x, y + h, x, y + h - rr, rr);
  g.lineTo(x, y + rr);
  g.arcTo(x, y, x + rr, y, rr);
  g.closePath();
}

/** Quad along one lane between two depths, `half` = half-width share of a lane. */
function laneQuad(g: CanvasRenderingContext2D, L: Layout, lane: number, zA: number, zB: number, half: number) {
  const xa = laneXAt(L, lane, zA);
  const xb = laneXAt(L, lane, zB);
  const wa = laneWidthAt(L, zA) * half;
  const wb = laneWidthAt(L, zB) * half;
  const ya = yAt(L, zA);
  const yb = yAt(L, zB);
  g.beginPath();
  g.moveTo(xa - wa, ya);
  g.lineTo(xa + wa, ya);
  g.lineTo(xb + wb, yb);
  g.lineTo(xb - wb, yb);
  g.closePath();
}

export function drawScene(g: CanvasRenderingContext2D, L: Layout, P: Palette, S: SceneState) {
  g.setTransform(L.dpr, 0, 0, L.dpr, 0, 0);
  g.clearRect(0, 0, L.w, L.h);
  if (S.reveal <= 0) return;

  g.save();
  g.translate(S.shakeX, S.shakeY);
  const vis = 1 - S.dim * 0.7;
  const lineColor = S.critical ? P.critical : P.accent;

  drawLanes(g, L, P, S, vis);
  drawBeatLines(g, L, P, S, vis);
  drawSeparators(g, L, P, S, vis);
  drawSigningLine(g, L, P, S, vis, lineColor);
  drawTails(g, L, P, S, vis);
  drawPads(g, L, P, S, vis);
  drawNotes(g, L, P, S, vis);
  drawFx(g, L, S);
  drawSparks(g, P, S);
  g.restore();

  if (S.flash > 0.001) {
    g.fillStyle = rgba(P.accent, S.flash * 0.07);
    g.fillRect(0, 0, L.w, L.h);
  }
}

function laneReveal(S: SceneState, i: number) {
  return easeOut((S.reveal - i * 0.045) / 0.56);
}

function drawLanes(g: CanvasRenderingContext2D, L: Layout, P: Palette, S: SceneState, vis: number) {
  const base = S.critical ? mix(P.ink, P.critical, 0.35) : P.ink;
  const yNear = yAt(L, L.zNear);
  for (let i = 0; i < LANE_COUNT; i++) {
    const reveal = laneReveal(S, i);
    if (reveal <= 0) continue;
    const pulse = S.lanes[i].pulse;
    const a = (0.05 * reveal + pulse * 0.08 + S.beat * 0.04 * reveal) * vis;
    const grad = g.createLinearGradient(0, yNear, 0, L.farY);
    grad.addColorStop(0, rgba(base, a));
    grad.addColorStop(0.55, rgba(base, a * 0.55));
    grad.addColorStop(1, rgba(base, 0));
    g.fillStyle = grad;
    laneQuad(g, L, i, L.zNear, 1, 0.46);
    g.fill();
  }
}

function drawBeatLines(g: CanvasRenderingContext2D, L: Layout, P: Palette, S: SceneState, vis: number) {
  const grid = S.grid;
  if (!grid || S.travel <= 0) return;
  const reveal = easeOut((S.reveal - 0.3) / 0.6);
  if (reveal <= 0) return;
  const first = Math.ceil((S.now - grid.t0) / grid.beatSec);
  const last = Math.floor((S.now + S.travel - grid.t0) / grid.beatSec);
  g.lineWidth = 1;
  for (let b = Math.max(0, first); b <= last; b++) {
    const z = (grid.t0 + b * grid.beatSec - S.now) / S.travel;
    if (z < 0 || z > 1) continue;
    const bar = b % 4 === 0;
    const y = yAt(L, z);
    const half = (L.nearW * depthScale(L, z)) / 2;
    g.strokeStyle = rgba(P.ink, (bar ? 0.13 : 0.055) * (1 - z * 0.7) * reveal * vis);
    g.beginPath();
    g.moveTo(L.cx - half, y);
    g.lineTo(L.cx + half, y);
    g.stroke();
  }
}

function drawSeparators(g: CanvasRenderingContext2D, L: Layout, P: Palette, S: SceneState, vis: number) {
  const yNear = yAt(L, L.zNear);
  const nearScale = depthScale(L, L.zNear);
  g.lineWidth = 1;
  for (let i = 0; i <= LANE_COUNT; i++) {
    const reveal = easeOut((S.reveal - 0.18 - i * 0.018) / 0.48);
    if (reveal <= 0) continue;
    const shimmer = 0.8 + Math.sin(S.elapsed * 4 + i) * 0.08;
    const a = (0.34 * reveal * shimmer + S.beat * 0.16 * reveal) * vis;
    const offset = i - LANE_COUNT / 2;
    const xNear = L.cx + (offset * L.nearW * nearScale) / LANE_COUNT;
    const xFar = L.cx + (offset * L.nearW * FAR_SCALE) / LANE_COUNT;
    const grad = g.createLinearGradient(0, yNear, 0, L.farY);
    grad.addColorStop(0, rgba(P.ink, a));
    grad.addColorStop(1, rgba(P.ink, a * 0.15));
    g.strokeStyle = grad;
    g.beginPath();
    g.moveTo(xNear, yNear);
    g.lineTo(xFar, L.farY);
    g.stroke();
  }
}

function drawSigningLine(
  g: CanvasRenderingContext2D,
  L: Layout,
  P: Palette,
  S: SceneState,
  vis: number,
  color: RGB,
) {
  const reveal = easeOut((S.reveal - 0.3) / 0.5);
  if (reveal <= 0) return;
  const half = L.nearW / 2 + 14;
  const x0 = L.cx - half * reveal;
  const x1 = L.cx + half * reveal;
  g.lineCap = "round";
  g.strokeStyle = rgba(color, (0.1 + S.beat * 0.1) * vis);
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(x0, L.hitY);
  g.lineTo(x1, L.hitY);
  g.stroke();
  g.strokeStyle = rgba(color, 0.95 * vis);
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(x0, L.hitY);
  g.lineTo(x1, L.hitY);
  g.stroke();
  g.lineCap = "butt";

  if (S.showSignLabel && !L.compact) {
    g.font = `500 10px ${P.fontMono}`;
    g.textAlign = "right";
    g.textBaseline = "middle";
    g.fillStyle = rgba(S.critical ? P.critical : P.grey300, 0.75 * reveal * vis);
    g.fillText("SIGN", x0 - 8, L.hitY);
  }
}

function drawTails(g: CanvasRenderingContext2D, L: Layout, P: Palette, S: SceneState, vis: number) {
  for (const n of S.notes) {
    if (n.holdSec <= 0) continue;
    let alpha: number;
    let color: RGB;
    let zHead = (n.hitTime - S.now) / S.travel;
    if (n.state === "held") {
      zHead = 0;
      alpha = 0.62;
      color = P.accent;
    } else if (n.state === "live") {
      alpha = 0.34;
      color = P.accent;
    } else if (n.state === "blind") {
      const age = S.now - n.changedAt;
      alpha = 0.3 * clamp01(1 - age / 0.5);
      color = P.blind;
      zHead = Math.max(zHead, 0);
    } else continue;
    const zEnd = Math.min(1, (n.endTime - S.now) / S.travel);
    const zA = Math.max(zHead, L.zNear);
    if (zEnd <= zA || alpha <= 0) continue;
    const grad = g.createLinearGradient(0, yAt(L, zA), 0, yAt(L, zEnd));
    grad.addColorStop(0, rgba(color, alpha * vis));
    grad.addColorStop(1, rgba(color, alpha * vis * (zEnd >= 1 ? 0 : 0.6)));
    g.fillStyle = grad;
    laneQuad(g, L, n.lane, zA, zEnd, 0.14);
    g.fill();
  }

  // Short approach streaks behind tap bytes.
  for (const n of S.notes) {
    if (n.holdSec > 0 || n.state !== "live") continue;
    const z = (n.hitTime - S.now) / S.travel;
    if (z < 0 || z > 1) continue;
    const zb = Math.min(1, z + 0.07);
    const grad = g.createLinearGradient(0, yAt(L, z), 0, yAt(L, zb));
    grad.addColorStop(0, rgba(P.accent, 0.24 * vis));
    grad.addColorStop(1, rgba(P.accent, 0));
    g.fillStyle = grad;
    laneQuad(g, L, n.lane, z, zb, 0.2);
    g.fill();
  }
}

function padTint(P: Palette, lane: LaneFx): RGB {
  const red = clamp01(lane.missFlash + (lane.noNote ? lane.force : 0));
  if (red > 0.01) return mix(P.ink, P.critical, red);
  return mix(P.ink, P.accent, clamp01(lane.force * 0.8 + lane.approach * 0.35));
}

function drawPads(g: CanvasRenderingContext2D, L: Layout, P: Palette, S: SceneState, vis: number) {
  const size = padSize(L);
  for (let i = 0; i < LANE_COUNT; i++) {
    const reveal = easeOut((S.reveal - 0.42 - i * 0.025) / 0.42);
    if (reveal <= 0) continue;
    const lane = S.lanes[i];
    const force = lane.force * lane.force * (3 - 2 * lane.force);
    const w = size.w * (1 + force * 0.12) * (1 + lane.pop * 0.14) * (0.7 + 0.3 * reveal);
    const h = size.h * (1 - lane.press * 0.45) * (1 + force * 0.2) * (1 + lane.pop * 0.1);
    const x = laneXAt(L, i, 0) - w / 2;
    const y = L.hitY - h / 2;
    const tint = padTint(P, lane);
    const breath = (Math.sin(S.elapsed * 1.6 + i * 0.65) * 0.5 + 0.5) * 0.04;

    roundRectPath(g, x, y, w, h, h * 0.28);
    g.fillStyle = rgba(tint, (0.06 + lane.approach * 0.14 + lane.press * 0.22 + force * 0.12 + breath) * reveal * vis);
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = rgba(tint, (0.5 + lane.approach * 0.35 + lane.press * 0.4 + S.beat * 0.12) * reveal * vis);
    g.stroke();

    const fill = Math.max(lane.coreFill, force * 0.78);
    if (fill > 0.02) {
      const cw = (w - 6) * fill;
      const ch = (h - 6) * fill;
      roundRectPath(g, laneXAt(L, i, 0) - cw / 2, L.hitY - ch / 2, cw, ch, ch * 0.28);
      g.fillStyle = rgba(lane.noNote ? P.critical : P.accent, fill * (0.45 + lane.corePulse * 0.45) * vis);
      g.fill();
    }
  }
}

function drawChip(
  g: CanvasRenderingContext2D,
  P: Palette,
  x: number,
  y: number,
  w: number,
  hex: string,
  stroke: RGB,
  fill: RGB,
  fillAlpha: number,
  text: RGB,
  alpha: number,
) {
  const h = w * 0.5;
  roundRectPath(g, x - w / 2, y - h / 2, w, h, h * 0.3);
  g.fillStyle = rgba(fill, fillAlpha * alpha);
  g.fill();
  g.lineWidth = Math.max(1, w * 0.03);
  g.strokeStyle = rgba(stroke, alpha);
  g.stroke();
  const px = Math.max(6, Math.round(h * 0.62));
  g.font = `500 ${px}px ${P.fontMono}`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = rgba(text, alpha);
  g.fillText(hex, x, y + px * 0.04);
}

function drawNotes(g: CanvasRenderingContext2D, L: Layout, P: Palette, S: SceneState, vis: number) {
  // Chord connectors first so chips sit on top.
  g.lineWidth = 1;
  for (const n of S.notes) {
    const other = n.partner;
    if (!other || n.state !== "live" || other.state !== "live" || other.lane < n.lane) continue;
    const z = (n.hitTime - S.now) / S.travel;
    if (z < 0 || z > 1) continue;
    const cw = laneWidthAt(L, z) * 0.64;
    const y = yAt(L, z);
    g.strokeStyle = rgba(P.ink, 0.3 * vis * clamp01((1.02 - z) / 0.1));
    g.beginPath();
    g.moveTo(laneXAt(L, n.lane, z) + cw / 2, y);
    g.lineTo(laneXAt(L, other.lane, z) - cw / 2, y);
    g.stroke();
  }

  for (let idx = S.notes.length - 1; idx >= 0; idx--) {
    const n = S.notes[idx];
    const age = S.now - n.changedAt;
    switch (n.state) {
      case "live": {
        const z = (n.hitTime - S.now) / S.travel;
        if (z > 1.02) break;
        const zc = Math.max(z, L.zNear);
        const alpha = clamp01((1.02 - z) / 0.1) * vis;
        const w = laneWidthAt(L, zc) * 0.64;
        const near = clamp01(1 - z / 0.25);
        const x = laneXAt(L, n.lane, zc);
        const y = yAt(L, zc);
        if (near > 0) {
          roundRectPath(g, x - w * 0.56, y - w * 0.3, w * 1.12, w * 0.6, w * 0.18);
          g.fillStyle = rgba(P.accent, 0.12 * near * alpha);
          g.fill();
        }
        drawChip(g, P, x, y, w, n.hex, mix(P.accent, P.ink, near * 0.6), P.dark, 0.9, P.ink, alpha);
        break;
      }
      case "held": {
        const w = laneWidthAt(L, 0) * 0.6;
        drawChip(g, P, laneXAt(L, n.lane, 0), L.hitY, w, n.hex, P.ink, P.accent, 0.9, P.onAccent, vis);
        break;
      }
      case "read": {
        const t = clamp01(age / 0.26);
        if (t >= 1) break;
        const w = laneWidthAt(L, 0) * 0.64 * (1 + easeOut(t) * 0.55);
        drawChip(g, P, laneXAt(L, n.lane, 0), L.hitY, w, n.hex, P.ink, P.accent, 0.9, P.onAccent, (1 - t) * vis);
        break;
      }
      case "blind": {
        const fade = clamp01(1 - age / 0.5);
        // A hold that was hit and then let go has no head left to fall.
        if (fade <= 0 || n.headHit) break;
        const z = Math.max((n.hitTime - S.now) / S.travel, L.zNear * 1.6);
        const w = laneWidthAt(L, z) * 0.64;
        drawChip(g, P, laneXAt(L, n.lane, z), yAt(L, z), w, n.hex, P.blind, P.dark, 0.7, P.blind, 0.6 * fade * vis);
        break;
      }
      case "dropped": {
        const fade = clamp01(1 - age / 0.25);
        if (fade <= 0) break;
        const z = Math.max((n.hitTime - S.now) / S.travel, L.zNear);
        if (z > 1.02) break;
        const w = laneWidthAt(L, z) * 0.64;
        drawChip(g, P, laneXAt(L, n.lane, z), yAt(L, z), w, n.hex, P.grey100, P.dark, 0.7, P.grey100, 0.6 * fade * vis);
        break;
      }
    }
  }
}

function drawFx(g: CanvasRenderingContext2D, L: Layout, S: SceneState) {
  for (const f of S.fx) {
    const t = clamp01(f.life / f.max);
    const x = laneXAt(L, f.lane, 0);
    switch (f.kind) {
      case "ring": {
        const e = easeOut(t);
        const w = f.w0 + (f.w1 - f.w0) * e;
        const h = f.h0 + (f.h1 - f.h0) * e;
        roundRectPath(g, x - w / 2, L.hitY - h / 2, w, h, h * 0.3);
        g.lineWidth = 0.5 + 2 * (1 - t);
        g.strokeStyle = rgba(f.color, f.alpha * (1 - t));
        g.stroke();
        break;
      }
      case "beam": {
        const top = f.big ? 0.4 : 0.27;
        const grad = g.createLinearGradient(0, L.hitY, 0, yAt(L, top));
        grad.addColorStop(0, rgba(f.color, f.alpha * (1 - t)));
        grad.addColorStop(1, rgba(f.color, 0));
        g.fillStyle = grad;
        laneQuad(g, L, f.lane, 0, top, 0.15 * (1 - t * 0.8));
        g.fill();
        break;
      }
      case "bolt": {
        const top = yAt(L, f.big ? 0.85 : 0.4);
        const lw = laneWidthAt(L, 0);
        const segments = f.big ? 9 : 6;
        g.beginPath();
        g.moveTo(x, L.hitY);
        for (let s = 1; s <= segments; s++) {
          const k = s / segments;
          const spread = lw * (f.big ? 0.32 : 0.2) * (1 - k * 0.5) * depthScale(L, k * 0.5);
          g.lineTo(x + (Math.random() - 0.5) * spread, L.hitY + (top - L.hitY) * k);
        }
        g.lineJoin = "round";
        g.strokeStyle = rgba(f.color, f.alpha * 0.22 * (1 - t));
        g.lineWidth = f.big ? 9 : 5;
        g.stroke();
        g.strokeStyle = rgba(f.color, f.alpha * (1 - t));
        g.lineWidth = f.big ? 2.2 : 1.4;
        g.stroke();
        break;
      }
      case "impact": {
        const e = easeOut(t);
        const rx = f.w0 + (f.w1 - f.w0) * e;
        g.beginPath();
        g.ellipse(x, L.hitY, rx, rx * 0.28, 0, 0, Math.PI * 2);
        g.lineWidth = 2 * (1 - t) + 0.5;
        g.strokeStyle = rgba(f.color, f.alpha * (1 - t));
        g.stroke();
        break;
      }
    }
  }
}

function drawSparks(g: CanvasRenderingContext2D, P: Palette, S: SceneState) {
  if (S.sparks.length === 0) return;
  g.textAlign = "center";
  g.textBaseline = "middle";
  let lastSize = -1;
  for (const s of S.sparks) {
    const t = clamp01(s.life / s.max);
    if (s.size !== lastSize) {
      g.font = `500 ${s.size}px ${P.fontMono}`;
      lastSize = s.size;
    }
    g.fillStyle = rgba(s.color, 1 - t);
    g.fillText(s.char, s.x, s.y);
  }
}
