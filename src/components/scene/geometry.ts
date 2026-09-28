// Every point the scene draws, laid out once: its place in the mark and its
// place in each of the other formations. The vertex shader blends between
// them, so nothing here runs per frame. Pure math: no three.js.
//
// The mark is built from brand/make-mark.py on its 1024 grid, rescaled so the
// C's centreline radius is 1. The C becomes three concentric rows of curved
// rods, each a regular shell lattice (the reference's octagon rods); the S
// becomes a tube of rings with round caps. Lattices are never jittered: the
// regular grid is the look.

const UNIT = 292;
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

export const MARK = {
  cRadius: 1,
  cStroke: 132 / UNIT,
  gapDeg: 54,
  sRadius: 118 / UNIT,
  sStroke: 104 / UNIT,
  sShift: 26 / UNIT,
  knockout: 15 / UNIT,
} as const;

/** Outer radius of the mark, for framing. */
export const MARK_EXTENT = MARK.cRadius + MARK.cStroke / 2;

/** x of the middle of the mark's visual bounds (the C's back to its terminals), mark units. */
export const MARK_VISUAL_CX = (MARK_EXTENT * Math.cos(MARK.gapDeg * DEG) - MARK_EXTENT) / 2;

/** Intro timeline, seconds from `introStarted`. */
export const INTRO = {
  dotIn: 0.35,
  cStart: 0.35,
  cSpan: 1.2,
  rodGrow: 0.32,
  rowLag: 0.06,
  sStart: 0.85,
  sSpan: 1.15,
  flight: 0.9,
  dotOutStart: 2.1,
  dotOutEnd: 2.8,
  total: 3.0,
} as const;

// C construction: three rows of rods fill the 132 stroke.
const ROW_GAP = 0.035;
const ROD_GAP = 0.045;
const ROD_T = (MARK.cStroke - 2 * ROW_GAP) / 3;
const ROD_D = ROD_T;
const C_ROWS = [
  { r: MARK.cRadius - MARK.cStroke / 2 + ROD_T / 2, n: 7 },
  { r: MARK.cRadius, n: 8 },
  { r: MARK.cRadius + MARK.cStroke / 2 - ROD_T / 2, n: 9 },
] as const;
const C_FROM = MARK.gapDeg * DEG;
const C_ARC = (360 - 2 * MARK.gapDeg) * DEG;

// S construction: two bowls, each 236° of a circle, meeting at the waist.
type Arc = { cx: number; cy: number; start: number; sweep: number };
const S_TOP: Arc = { cx: MARK.sShift, cy: MARK.sRadius, start: 34 * DEG, sweep: 236 * DEG };
const S_BOTTOM: Arc = { cx: MARK.sShift, cy: -MARK.sRadius, start: 90 * DEG, sweep: -236 * DEG };
const S_RHO = MARK.sStroke / 2;
const S_RHO_Z = S_RHO * 0.72;
const S_LENGTH = 2 * MARK.sRadius * 236 * DEG;
const S_Z = 0.02;

export type SceneGeometry = {
  count: number;
  /** Mark position, xyz. */
  mark: Float32Array;
  /** part (0 C, 1 S), intro delay (s), two uniform randoms. */
  info: Float32Array;
  /** Reads: side (-1 | 1), offset in lattice units (width 1), xyz. */
  reads: Float32Array;
  /** Band: NDC x, world y offset, world z. */
  band: Float32Array;
  /** Field: NDC x, NDC y, world z at t = 0. */
  field: Float32Array;
  /** Ships: cluster index, local xyz. */
  ships: Float32Array;
  /** Per-formation brightness (0 = unused slot): reads, band, field threshold, ships. */
  vis: Float32Array;
  /** Mark lattice spacing, in mark units. */
  spacing: number;
};

type Emit = (x: number, y: number, z: number, part: number, delay: number) => void;
type Put = (x: number, y: number, z: number) => void;

function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function distToArc(x: number, y: number, arc: Arc, r: number): number {
  const dx = x - arc.cx;
  const dy = y - arc.cy;
  const theta = Math.atan2(dy, dx);
  let rel = arc.sweep > 0 ? theta - arc.start : arc.start - theta;
  rel = ((rel % TAU) + TAU) % TAU;
  if (rel <= Math.abs(arc.sweep)) return Math.abs(Math.hypot(dx, dy) - r);
  const a1 = arc.start;
  const a2 = arc.start + arc.sweep;
  return Math.min(
    Math.hypot(x - (arc.cx + r * Math.cos(a1)), y - (arc.cy + r * Math.sin(a1))),
    Math.hypot(x - (arc.cx + r * Math.cos(a2)), y - (arc.cy + r * Math.sin(a2))),
  );
}

/** Distance from a point to the S's centreline, round terminals included. */
function distToS(x: number, y: number): number {
  return Math.min(distToArc(x, y, S_TOP, MARK.sRadius), distToArc(x, y, S_BOTTOM, MARK.sRadius));
}

/** Position and unit tangent along the S, t in 0..1 from the top terminal. */
function sAt(t: number): [number, number, number, number] {
  const arc = t < 0.5 ? S_TOP : S_BOTTOM;
  const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const a = arc.start + arc.sweep * u;
  const sign = Math.sign(arc.sweep);
  return [
    arc.cx + MARK.sRadius * Math.cos(a),
    arc.cy + MARK.sRadius * Math.sin(a),
    -Math.sin(a) * sign,
    Math.cos(a) * sign,
  ];
}

/** Lays the mark out at lattice spacing `h`. With no `emit`, only counts. */
function emitMark(h: number, emit: Emit | null): number {
  let count = 0;
  const keepOut = MARK.sStroke / 2 + MARK.knockout;

  // The C: rows of curved rods, every end cut radially, so both terminals are flat.
  C_ROWS.forEach(({ r, n }, row) => {
    const gapAngle = ROD_GAP / r;
    const span = (C_ARC - gapAngle * (n - 1)) / n;
    const ns = Math.max(2, Math.round((span * r) / h) + 1);
    const nu = Math.max(2, Math.round(ROD_T / h) + 1);
    const nw = Math.max(2, Math.round(ROD_D / h) + 1);
    const chamfer = nu > 3 && nw > 3;
    for (let k = 0; k < n; k++) {
      const a0 = C_FROM + k * (span + gapAngle);
      const order = (a0 + span / 2 - C_FROM) / C_ARC;
      for (let is = 0; is < ns; is++) {
        const f = is / (ns - 1);
        const angle = a0 + f * span;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const onS = is === 0 || is === ns - 1;
        for (let iu = 0; iu < nu; iu++) {
          const onU = iu === 0 || iu === nu - 1;
          const rr = r + (iu / (nu - 1) - 0.5) * ROD_T;
          const x = rr * cos;
          const y = rr * sin;
          if (distToS(x, y) < keepOut) continue;
          for (let iw = 0; iw < nw; iw++) {
            const onW = iw === 0 || iw === nw - 1;
            if (!(onS || onU || onW)) continue;
            if (chamfer && onU && onW) continue;
            count++;
            if (emit) {
              const z = (iw / (nw - 1) - 0.5) * ROD_D;
              const delay = INTRO.cStart + INTRO.cSpan * order + INTRO.rodGrow * f + INTRO.rowLag * row;
              emit(x, y, z, 0, delay);
            }
          }
        }
      }
    }
  });

  // The S: rings along the path. Same ring count everywhere, so the lattice
  // runs in continuous lines down the tube.
  const ringCount = Math.max(8, Math.round((TAU * Math.sqrt((S_RHO * S_RHO + S_RHO_Z * S_RHO_Z) / 2)) / h));
  const steps = Math.max(2, Math.round(S_LENGTH / h) + 1);
  for (let l = 0; l < steps; l++) {
    const t = l / (steps - 1);
    const [x, y, tx, ty] = sAt(t);
    const nx = -ty;
    const ny = tx;
    const delay = INTRO.sStart + INTRO.sSpan * t;
    for (let k = 0; k < ringCount; k++) {
      count++;
      if (emit) {
        const phi = (TAU * k) / ringCount;
        const c = Math.cos(phi) * S_RHO;
        emit(x + nx * c, y + ny * c, S_Z + Math.sin(phi) * S_RHO_Z, 1, delay);
      }
    }
  }

  // Round caps: rings shrinking to a tip beyond each terminal.
  const capRings = Math.max(2, Math.round((Math.PI / 2) * S_RHO / h));
  for (const end of [0, 1]) {
    const [x, y, tx, ty] = sAt(end);
    const ox = end === 0 ? -tx : tx;
    const oy = end === 0 ? -ty : ty;
    const nx = -ty;
    const ny = tx;
    const delay = INTRO.sStart + INTRO.sSpan * end;
    for (let kk = 1; kk <= capRings; kk++) {
      const alpha = (kk / capRings) * (Math.PI / 2);
      const ring = Math.cos(alpha);
      const out = Math.sin(alpha) * S_RHO;
      const m = Math.max(1, Math.round(ringCount * ring));
      for (let j = 0; j < m; j++) {
        count++;
        if (emit) {
          const phi = (TAU * j) / m + (kk % 2 ? Math.PI / m : 0);
          const c = Math.cos(phi) * S_RHO * ring;
          emit(x + ox * out + nx * c, y + oy * out + ny * c, S_Z + Math.sin(phi) * S_RHO_Z * ring, 1, delay);
        }
      }
    }
  }

  return count;
}

/** A box shell lattice centred on (cx, cy, cz); edges chamfered like the rods. */
function boxShell(
  sx: number,
  sy: number,
  sz: number,
  h: number,
  put: Put | null,
  cx = 0,
  cy = 0,
  cz = 0,
): number {
  const nx = Math.max(2, Math.round(sx / h) + 1);
  const ny = Math.max(2, Math.round(sy / h) + 1);
  const nz = Math.max(2, Math.round(sz / h) + 1);
  let count = 0;
  for (let i = 0; i < nx; i++) {
    const ex = i === 0 || i === nx - 1 ? 1 : 0;
    for (let j = 0; j < ny; j++) {
      const ey = j === 0 || j === ny - 1 ? 1 : 0;
      for (let k = 0; k < nz; k++) {
        const ez = k === 0 || k === nz - 1 ? 1 : 0;
        const extremes = ex + ey + ez;
        if (extremes === 0) continue;
        if (extremes >= 2 && nx > 3 && ny > 3 && nz > 3) continue;
        count++;
        put?.(
          cx + (i / (nx - 1) - 0.5) * sx,
          cy + (j / (ny - 1) - 0.5) * sy,
          cz + (k / (nz - 1) - 0.5) * sz,
        );
      }
    }
  }
  return count;
}

function torus(major: number, minor: number, h: number, put: Put | null): number {
  const nMajor = Math.max(12, Math.round((TAU * major) / h));
  const nMinor = Math.max(6, Math.round((TAU * minor) / h));
  if (put) {
    for (let i = 0; i < nMajor; i++) {
      const a = (TAU * i) / nMajor;
      for (let j = 0; j < nMinor; j++) {
        const b = (TAU * j) / nMinor;
        const rr = major + minor * Math.cos(b);
        put(rr * Math.cos(a), rr * Math.sin(a), minor * Math.sin(b));
      }
    }
  }
  return nMajor * nMinor;
}

// The four things ClearSign ships as, one cluster each: the core (a cube), the
// desktop app (a slab), the command line (lines of text), the signer image (a ring).
const TEXT_LINES = [0.8, 0.52, 0.66] as const;
const SHIP_SHAPES: ((h: number, put: Put | null) => number)[] = [
  (h, put) => boxShell(0.46, 0.46, 0.46, h, put),
  (h, put) => boxShell(0.72, 0.46, 0.08, h, put),
  (h, put) =>
    TEXT_LINES.reduce(
      (sum, len, i) => sum + boxShell(len, 0.085, 0.085, h, put, -0.4 + len / 2, 0.16 - i * 0.16, 0),
      0,
    ),
  (h, put) => torus(0.28, 0.06, h, put),
];

/** Largest lattice spacing whose point count stays within `budget` (surface: count ~ 1/h^2). */
function solveSpacing(count: (h: number) => number, budget: number, start: number): number {
  let h = start;
  for (let i = 0; i < 4; i++) {
    const c = count(h);
    if (c <= 0) break;
    h *= Math.sqrt(c / budget);
  }
  let guard = 0;
  while (count(h) > budget && guard++ < 60) h *= 1.03;
  return h;
}

function sortedIndices(keys: Float64Array): Uint32Array {
  const idx = new Uint32Array(keys.length);
  for (let i = 0; i < idx.length; i++) idx[i] = i;
  idx.sort((a, b) => keys[a] - keys[b]);
  return idx;
}

export function buildSceneGeometry(targetPoints: number, seed = 20250221): SceneGeometry {
  const rand = mulberry32(seed);

  // ── The mark, at the spacing the budget allows ───────────────────────────
  const h = solveSpacing((s) => emitMark(s, null), targetPoints, 0.02);
  const N = emitMark(h, null);
  const mark = new Float32Array(N * 3);
  const info = new Float32Array(N * 4);
  let p = 0;
  emitMark(h, (x, y, z, part, delay) => {
    mark[p * 3] = x;
    mark[p * 3 + 1] = y;
    mark[p * 3 + 2] = z;
    info[p * 4] = part;
    info[p * 4 + 1] = delay;
    info[p * 4 + 2] = rand();
    info[p * 4 + 3] = rand();
    p++;
  });

  // Points are matched to every formation's slots by rank of their x in the
  // mark, so each morph flows left to left instead of crossing over itself.
  const markKeys = new Float64Array(N);
  for (let i = 0; i < N; i++) markKeys[i] = mark[i * 3] + (info[i * 4 + 2] - 0.5) * 0.12;
  const byRank = sortedIndices(markKeys);

  const vis = new Float32Array(N * 4);
  const assign = (keys: Float64Array, write: (point: number, slot: number) => void) => {
    const slots = sortedIndices(keys);
    for (let r = 0; r < N; r++) write(byRank[r], slots[r]);
  };

  // ── Reads: two lattices of byte-blocks ───────────────────────────────────
  const reads = new Float32Array(N * 4);
  {
    const cols = 5;
    const rows = 6;
    const pitch = 1 / cols;
    const blockSize = pitch * 0.62;
    const blockDepth = blockSize * 0.7;
    const blocks = 2 * cols * rows;
    const depthOf = (n: number) => Math.max(2, Math.round(n * 0.5));
    let n = 3;
    while (blocks * (n + 1) * (n + 1) * depthOf(n + 1) <= 0.55 * N) n++;
    const nd = depthOf(n);
    const perBlock = n * n * nd;
    const visible = Math.min(N, blocks * perBlock);

    const side = new Float32Array(N);
    const lx = new Float32Array(N);
    const ly = new Float32Array(N);
    const lz = new Float32Array(N);
    const bright = new Float32Array(N);
    const keys = new Float64Array(N);
    let s = 0;
    for (const sd of [-1, 1]) {
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const bx = (col - (cols - 1) / 2) * pitch;
          const by = ((rows - 1) / 2 - row) * pitch;
          // Some bytes sit dim: not every byte in a dump is the one that matters.
          const level = rand() < 0.18 ? 0.16 : 0.5 + 0.5 * rand();
          for (let i = 0; i < n && s < visible; i++) {
            for (let j = 0; j < n && s < visible; j++) {
              for (let k = 0; k < nd && s < visible; k++) {
                side[s] = sd;
                lx[s] = bx + (i / (n - 1) - 0.5) * blockSize;
                ly[s] = by + (j / (n - 1) - 0.5) * blockSize;
                lz[s] = (k / (nd - 1) - 0.5) * blockDepth;
                bright[s] = level;
                keys[s] = (sd + 1) * 10 + lx[s];
                s++;
              }
            }
          }
        }
      }
    }
    // Spare slots ride along with a random visible one, unseen.
    for (; s < N; s++) {
      const src = Math.floor(rand() * visible);
      side[s] = side[src];
      lx[s] = lx[src];
      ly[s] = ly[src];
      lz[s] = lz[src];
      bright[s] = 0;
      keys[s] = keys[src];
    }
    assign(keys, (point, slot) => {
      reads[point * 4] = side[slot];
      reads[point * 4 + 1] = lx[slot];
      reads[point * 4 + 2] = ly[slot];
      reads[point * 4 + 3] = lz[slot];
      vis[point * 4] = bright[slot];
    });
  }

  // ── Band: a dense strip low on screen, receding in depth ─────────────────
  const band = new Float32Array(N * 3);
  {
    const rows = 5;
    const layers = 10;
    const perColumn = rows * layers;
    const cols = Math.max(2, Math.ceil(N / perColumn));
    // Smooth brightness along the strip, so it reads as light, not a bar.
    const knots = Array.from({ length: 24 }, () => rand());
    const along = (t: number) => {
      const x = t * (knots.length - 1);
      const i = Math.min(knots.length - 2, Math.floor(x));
      const f = x - i;
      const s = f * f * (3 - 2 * f);
      return knots[i] + (knots[i + 1] - knots[i]) * s;
    };
    const x = new Float32Array(N);
    const y = new Float32Array(N);
    const z = new Float32Array(N);
    const bright = new Float32Array(N);
    const keys = new Float64Array(N);
    for (let s = 0; s < N; s++) {
      const c = Math.floor(s / perColumn);
      const rem = s % perColumn;
      const r = rem % rows;
      const l = Math.floor(rem / rows);
      const t = c / (cols - 1);
      x[s] = -1.12 + 2.24 * t;
      y[s] = (r / (rows - 1) - 0.5) * 0.11;
      z[s] = 0.8 - l * 0.5;
      bright[s] = (0.22 + 0.38 * along(t)) * (1 - l * 0.035);
      keys[s] = x[s];
    }
    assign(keys, (point, slot) => {
      band[point * 3] = x[slot];
      band[point * 3 + 1] = y[slot];
      band[point * 3 + 2] = z[slot];
      vis[point * 4 + 1] = bright[slot];
    });
  }

  // ── Field: a sparse volume across the whole frustum ──────────────────────
  const field = new Float32Array(N * 3);
  {
    const x = new Float32Array(N);
    const y = new Float32Array(N);
    const z = new Float32Array(N);
    const threshold = new Float32Array(N);
    const keys = new Float64Array(N);
    for (let s = 0; s < N; s++) {
      x[s] = (rand() * 2 - 1) * 1.25;
      y[s] = (rand() * 2 - 1) * 1.25;
      z[s] = 2 - rand() * 24;
      threshold[s] = rand();
      keys[s] = x[s];
    }
    assign(keys, (point, slot) => {
      field[point * 3] = x[slot];
      field[point * 3 + 1] = y[slot];
      field[point * 3 + 2] = z[slot];
      vis[point * 4 + 2] = threshold[slot];
    });
  }

  // ── Ships: four small clusters ───────────────────────────────────────────
  const ships = new Float32Array(N * 4);
  {
    const perCluster = Math.floor(N / SHIP_SHAPES.length);
    const budget = Math.floor((0.5 * N) / SHIP_SHAPES.length);
    const idx = new Float32Array(N);
    const lx = new Float32Array(N);
    const ly = new Float32Array(N);
    const lz = new Float32Array(N);
    const bright = new Float32Array(N);
    const keys = new Float64Array(N);
    let s = 0;
    SHIP_SHAPES.forEach((shape, c) => {
      const spacing = solveSpacing((sp) => shape(sp, null), budget, 0.03);
      const first = s;
      const last = c === SHIP_SHAPES.length - 1 ? N : first + perCluster;
      shape(spacing, (x, y, z) => {
        if (s >= last) return;
        idx[s] = c;
        lx[s] = x;
        ly[s] = y;
        lz[s] = z;
        bright[s] = 0.75 + 0.25 * rand();
        keys[s] = c * 10 + x;
        s++;
      });
      const made = s - first;
      for (; s < last; s++) {
        const src = first + Math.floor(rand() * Math.max(1, made));
        idx[s] = c;
        lx[s] = lx[src];
        ly[s] = ly[src];
        lz[s] = lz[src];
        bright[s] = 0;
        keys[s] = keys[src];
      }
    });
    assign(keys, (point, slot) => {
      ships[point * 4] = idx[slot];
      ships[point * 4 + 1] = lx[slot];
      ships[point * 4 + 2] = ly[slot];
      ships[point * 4 + 3] = lz[slot];
      vis[point * 4 + 3] = bright[slot];
    });
  }

  return { count: N, mark, info, reads, band, field, ships, vis, spacing: h };
}
