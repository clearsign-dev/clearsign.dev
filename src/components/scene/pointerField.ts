// A small CPU velocity field in screen space, the cheap stand-in for the
// reference's GPU fluid sim (FluidMouseField). The pointer splats its velocity
// in, the field carries itself along (semi-Lagrangian advection), bleeds into
// its neighbours and decays. The vertex shader samples it at each point's
// screen position, so points near a moving pointer drift, bloom and settle.
//
// Stored as RGBA8: velocity in uv/s mapped from [-RANGE, RANGE] to [0, 255] in
// R and G, speed in B. Bytes filter linearly everywhere; float textures do not.

export const FIELD_RANGE = 2;

const DECAY_SECONDS = 0.42;
const DIFFUSION = 0.2;
const ADVECTION = 0.6;
const SPLAT_RADIUS = 0.07;
const SPLAT_GAIN = 0.35;
const IDLE_EPSILON = 0.002;

export class PointerField {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array;
  private vx: Float32Array;
  private vy: Float32Array;
  private nx: Float32Array;
  private ny: Float32Array;
  private energy = 0;
  private dirty = true;
  private aspect: number;

  constructor(cells: number, aspect: number) {
    const a = Math.max(0.2, Math.min(5, aspect));
    this.aspect = a;
    this.width = Math.max(8, Math.round(Math.sqrt(cells * a)));
    this.height = Math.max(8, Math.round(Math.sqrt(cells / a)));
    const n = this.width * this.height;
    this.vx = new Float32Array(n);
    this.vy = new Float32Array(n);
    this.nx = new Float32Array(n);
    this.ny = new Float32Array(n);
    this.data = new Uint8Array(n * 4);
    this.encode();
  }

  /** Add velocity (uv/s, y up) around a point in uv space. */
  splat(u: number, v: number, dx: number, dy: number, radius = SPLAT_RADIUS): void {
    this.forEachInRadius(u, v, radius, (index, weight) => {
      this.vx[index] += dx * weight * SPLAT_GAIN;
      this.vy[index] += dy * weight * SPLAT_GAIN;
    });
    this.energy = Math.max(this.energy, Math.hypot(dx, dy) * SPLAT_GAIN);
  }

  /** A radial push outward from a point: the press ripple. */
  pulse(u: number, v: number, strength: number, radius = SPLAT_RADIUS * 1.6): void {
    const { width: w, height: h, aspect } = this;
    this.forEachInRadius(u, v, radius, (index, weight) => {
      const i = index % w;
      const j = (index - i) / w;
      const du = (i / (w - 1) - u) * aspect;
      const dv = j / (h - 1) - v;
      const d = Math.hypot(du, dv) || 1;
      this.vx[index] += (du / d / aspect) * strength * weight;
      this.vy[index] += (dv / d) * strength * weight;
    });
    this.energy = Math.max(this.energy, strength);
  }

  /** Advance the field. Returns true when the texture data changed. */
  step(dt: number): boolean {
    if (this.energy < IDLE_EPSILON) {
      if (!this.dirty) return false;
      this.vx.fill(0);
      this.vy.fill(0);
      this.encode();
      this.dirty = false;
      return true;
    }
    const { width: w, height: h } = this;
    const step = Math.min(dt, 1 / 30);

    // Self-advection: each cell takes the velocity found upstream of it.
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        const x = i - this.vx[k] * step * (w - 1) * ADVECTION;
        const y = j - this.vy[k] * step * (h - 1) * ADVECTION;
        this.nx[k] = this.sample(this.vx, x, y);
        this.ny[k] = this.sample(this.vy, x, y);
      }
    }

    // Diffuse into the four neighbours, decay, and measure what is left.
    const decay = Math.exp(-step / DECAY_SECONDS);
    let energy = 0;
    for (let j = 0; j < h; j++) {
      const up = j > 0 ? -w : 0;
      const down = j < h - 1 ? w : 0;
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        const left = i > 0 ? -1 : 0;
        const right = i < w - 1 ? 1 : 0;
        const ax = (this.nx[k + up] + this.nx[k + down] + this.nx[k + left] + this.nx[k + right]) * 0.25;
        const ay = (this.ny[k + up] + this.ny[k + down] + this.ny[k + left] + this.ny[k + right]) * 0.25;
        let vx = (this.nx[k] + (ax - this.nx[k]) * DIFFUSION) * decay;
        let vy = (this.ny[k] + (ay - this.ny[k]) * DIFFUSION) * decay;
        const speed = Math.hypot(vx, vy);
        if (speed > FIELD_RANGE) {
          vx *= FIELD_RANGE / speed;
          vy *= FIELD_RANGE / speed;
        }
        this.vx[k] = vx;
        this.vy[k] = vy;
        if (speed > energy) energy = speed;
      }
    }
    this.energy = energy;
    this.encode();
    this.dirty = true;
    return true;
  }

  /** Drop all motion now; the next step uploads the still field. */
  clear(): void {
    this.vx.fill(0);
    this.vy.fill(0);
    this.energy = 0;
    this.dirty = true;
  }

  private sample(field: Float32Array, x: number, y: number): number {
    const w = this.width;
    const h = this.height;
    const cx = Math.max(0, Math.min(w - 1.001, x));
    const cy = Math.max(0, Math.min(h - 1.001, y));
    const i = Math.floor(cx);
    const j = Math.floor(cy);
    const fx = cx - i;
    const fy = cy - j;
    const k = j * w + i;
    const a = field[k] + (field[k + 1] - field[k]) * fx;
    const b = field[k + w] + (field[k + w + 1] - field[k + w]) * fx;
    return a + (b - a) * fy;
  }

  private forEachInRadius(
    u: number,
    v: number,
    radius: number,
    visit: (index: number, weight: number) => void,
  ): void {
    const { width: w, height: h, aspect } = this;
    const r2 = radius * radius;
    const reachX = Math.ceil(((radius * 2.2) / aspect) * (w - 1));
    const reachY = Math.ceil(radius * 2.2 * (h - 1));
    const ci = Math.round(u * (w - 1));
    const cj = Math.round(v * (h - 1));
    for (let j = Math.max(0, cj - reachY); j <= Math.min(h - 1, cj + reachY); j++) {
      const dv = j / (h - 1) - v;
      for (let i = Math.max(0, ci - reachX); i <= Math.min(w - 1, ci + reachX); i++) {
        const du = (i / (w - 1) - u) * aspect;
        const weight = Math.exp(-(du * du + dv * dv) / r2);
        if (weight > 0.01) visit(j * w + i, weight);
      }
    }
  }

  private encode(): void {
    const { data } = this;
    const n = this.width * this.height;
    for (let k = 0; k < n; k++) {
      const vx = this.vx[k];
      const vy = this.vy[k];
      const o = k * 4;
      data[o] = Math.round((vx / (2 * FIELD_RANGE) + 0.5) * 255);
      data[o + 1] = Math.round((vy / (2 * FIELD_RANGE) + 0.5) * 255);
      data[o + 2] = Math.round(Math.min(1, Math.hypot(vx, vy) / FIELD_RANGE) * 255);
      data[o + 3] = 255;
    }
  }
}
