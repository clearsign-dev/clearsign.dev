// The evidence train's runtime. Scroll progress picks a target slide; the train
// glides toward it every frame and each card's transform is written straight
// to the DOM, so React only re-renders when the focused slide changes.
//
// Dragging scrubs the page scroll itself (as the reference's slider does), so
// the train, the scroll indicator and every scroll-linked reveal stay in step.

import { damp, linearBeatProgress, type Beat } from "@/lib/motion/progress";
import { SECTION_INDEX, globalAt } from "@/lib/stage/sections";
import { goToProgress } from "@/lib/stage/store";
import {
  DRAG,
  expoOut,
  releaseTarget,
  rubberBand,
  sampleVelocity,
  stepDuration,
  trimSamples,
  type DragSample,
} from "./trainDrag";
import {
  TRAIN,
  computeTrainMetrics,
  entryOffsets,
  exitOffsets,
  slidePose,
  stepVelocity,
  type TrainBand,
  type TrainMetrics,
  type VelocityState,
} from "./trainLayout";

export type TrainInput = {
  /** Section progress; runs past 1 while the section is being left. */
  progress: number;
  /** Section progress over which the train travels from first to last slide. */
  slides: Beat;
  /** Where the train starts arriving (the section's reveal start). */
  entryStart: number;
  /** Where it has fully left (the section's hide end). */
  exitEnd: number;
};

export type TrainElements = {
  stage: HTMLElement;
  band: HTMLElement;
  cards: (HTMLElement | null)[];
};

export type TrainCallbacks = {
  onFocusChange: (index: number) => void;
  onVisibleChange: (visible: boolean) => void;
  onInteractiveChange: (interactive: boolean) => void;
  onDragChange: (dragging: boolean) => void;
  /** The train moved under a resting pointer (throttled): re-check the hover. */
  onMovedUnderPointer: () => void;
  /** Free band between the copy above and the heading below (narrow layouts). */
  measureBand: () => TrainBand | null;
};

export type PointerMoveResult = "idle" | "started" | "dragging";

type Glide = { from: number; to: number; start: number; duration: number };

type DragState = {
  pointerId: number | null;
  armed: boolean;
  active: boolean;
  originX: number;
  originY: number;
  downX: number;
  downY: number;
  downAt: number;
  startIndex: number;
  index: number;
  card: number | null;
  samples: DragSample[];
};

const idleDrag = (): DragState => ({
  pointerId: null,
  armed: false,
  active: false,
  originX: 0,
  originY: 0,
  downX: 0,
  downY: 0,
  downAt: 0,
  startIndex: 0,
  index: 0,
  card: null,
  samples: [],
});

/** Keys the carousel answers itself (see EvidenceTrain). */
export const CAROUSEL_KEYS: ReadonlySet<string> = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

// The reference re-checks what is under a resting cursor this often.
const HOVER_RECHECK_MS = 120;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const px = (v: number) => `${v.toFixed(2)}px`;

export class TrainController {
  private readonly maxIndex: number;
  private metrics: TrainMetrics | null = null;
  private visual = 0;
  private readonly focusValues: number[];
  /** Cards wholly off-screen are hidden so they skip painting. */
  private readonly onScreen: boolean[];
  private readonly velocity: VelocityState = { prev: 0, target: 0, value: 0 };
  private entry = 0;
  private exit = 0;
  private focused = -1;
  private visible = false;
  private interactive = false;
  private started = false;
  private raf = 0;
  private last = 0;
  private reduced = false;
  private glide: Glide | null = null;
  private drag: DragState = idleDrag();
  private disposed = false;
  private lastHoverCheck = 0;
  private readonly cleanups: Array<() => void> = [];

  constructor(
    private readonly els: TrainElements,
    private readonly cb: TrainCallbacks,
    count: number,
    private input: TrainInput,
  ) {
    this.maxIndex = Math.max(0, count - 1);
    this.focusValues = new Array(count).fill(0);
    this.onScreen = new Array(count).fill(true);

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.reduced = media.matches;
    const onMedia = () => {
      this.reduced = media.matches;
      this.wake();
    };
    media.addEventListener("change", onMedia);
    this.cleanups.push(() => media.removeEventListener("change", onMedia));

    // Anything else that moves the page stops a glide this train started.
    // Presses and carousel keys on the train itself are handled by the train.
    const stopGlide = (event: Event) => {
      const target = event.target;
      const inside = target instanceof Node && this.els.stage.contains(target);
      if (inside && event.type === "pointerdown") return;
      if (inside && event instanceof KeyboardEvent && CAROUSEL_KEYS.has(event.key)) return;
      this.glide = null;
    };
    const opts = { capture: true, passive: true } as const;
    for (const type of ["wheel", "touchstart", "pointerdown", "keydown"] as const) {
      window.addEventListener(type, stopGlide, opts);
      this.cleanups.push(() => window.removeEventListener(type, stopGlide, opts));
    }

    this.resize();
  }

  destroy() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.cleanups.forEach((fn) => fn());
    this.cleanups.length = 0;
  }

  setInput(input: TrainInput) {
    this.input = input;
    this.wake();
  }

  isInteractive() {
    return this.interactive;
  }

  /** The section is the one on screen (not arriving, not being left). */
  private isActive() {
    return this.input.progress >= 0 && this.input.progress < 1;
  }

  isDragging() {
    return this.drag.active;
  }

  resize() {
    const { stage, band } = this.els;
    const vw = stage.clientWidth || window.innerWidth;
    const vh = stage.clientHeight || window.innerHeight;
    if (!vw || !vh) return;
    const narrow = vw <= 1024;
    const m = computeTrainMetrics(vw, vh, narrow ? this.cb.measureBand() : null);
    this.metrics = m;
    stage.style.setProperty("--perspective", px(m.perspective));
    stage.style.setProperty("--card-w", px(m.cardW));
    stage.style.setProperty("--card-h", px(m.cardH));
    // The drag band spans the focused card's height and a margin around it.
    const focusCentre = m.originY + 0.5 * m.unit;
    const bandHeight = m.cardH * 1.3;
    band.style.top = px(focusCentre - bandHeight / 2);
    band.style.height = px(bandHeight);
    this.wake();
  }

  // ── Scroll ──────────────────────────────────────────────────────────────

  private scrollIndex(): number {
    const { progress, slides } = this.input;
    const span = Math.max(slides.end - slides.start, 1e-6);
    return ((progress - slides.start) / span) * this.maxIndex;
  }

  private scrollTo(index: number) {
    const { slides } = this.input;
    const p = slides.start + (index / Math.max(1, this.maxIndex)) * (slides.end - slides.start);
    goToProgress(globalAt(SECTION_INDEX.evidence, p), { immediate: true });
  }

  private startGlide(from: number, to: number, duration: number) {
    if (duration <= 0 || this.reduced) {
      this.glide = null;
      this.scrollTo(to);
    } else {
      this.glide = { from, to, start: performance.now(), duration };
    }
    this.wake();
  }

  private glideIndex(now: number): number | null {
    const g = this.glide;
    if (!g) return null;
    const t = (now - g.start) / (g.duration * 1000);
    if (t >= 1) {
      this.glide = null;
      return g.to;
    }
    return g.from + (g.to - g.from) * expoOut(Math.max(0, t));
  }

  /** Move to a slide as a keyboard press or tap would. */
  goTo(index: number) {
    if (!this.isActive()) return;
    const to = clamp(Math.round(index), 0, this.maxIndex);
    const from = this.glideIndex(performance.now()) ?? this.scrollIndex();
    if (Math.abs(to - from) < 1e-3) return;
    this.startGlide(from, to, stepDuration(to - from));
  }

  /** One slide forward or back from where the train is headed. */
  step(delta: number) {
    const base = this.glide ? this.glide.to : Math.round(clamp(this.scrollIndex(), 0, this.maxIndex));
    this.goTo(base + delta);
  }

  // ── Pointer ─────────────────────────────────────────────────────────────

  pointerDown(pointerId: number, x: number, y: number, card: number | null) {
    // One drag at a time; a press that never became a drag is simply replaced.
    if (!this.interactive || this.drag.active) return;
    const now = performance.now();
    this.drag = {
      ...idleDrag(),
      pointerId,
      armed: true,
      originX: x,
      originY: y,
      downX: x,
      downY: y,
      downAt: now,
      card,
    };
  }

  pointerMove(pointerId: number, x: number, y: number): PointerMoveResult {
    const d = this.drag;
    if (!d.armed || pointerId !== d.pointerId) return "idle";
    if (!this.interactive || !this.metrics) {
      this.endDrag();
      return "idle";
    }
    const now = performance.now();
    if (!d.active) {
      if (Math.hypot(x - d.originX, y - d.originY) < DRAG.startThresholdPx) return "idle";
      // Re-base on the train as it looks now, so the first frame doesn't jump.
      d.active = true;
      this.glide = null;
      d.startIndex = clamp(this.visual, 0, this.maxIndex);
      d.index = d.startIndex;
      d.originX = x;
      d.originY = y;
      d.samples = [{ t: now, index: d.index }];
      this.els.stage.dataset.dragging = "true";
      this.cb.onDragChange(true);
      this.scrollTo(d.index);
      this.wake();
      return "started";
    }
    const raw = d.startIndex - (x - d.originX) / this.metrics.dragPxPerSlide;
    d.index = rubberBand(raw, this.maxIndex);
    this.scrollTo(d.index);
    d.samples.push({ t: now, index: d.index });
    trimSamples(d.samples, now);
    this.wake();
    return "dragging";
  }

  pointerUp(pointerId: number, x: number, y: number) {
    const d = this.drag;
    if (pointerId !== d.pointerId) return;
    if (d.active) {
      this.release();
      return;
    }
    const isTap =
      performance.now() - d.downAt <= DRAG.tapMaxMs &&
      Math.hypot(x - d.downX, y - d.downY) <= DRAG.tapMaxPx;
    const card = d.card;
    this.endDrag();
    // The reference opened the tapped post; here a tap brings that card forward.
    if (isTap && card !== null && card !== this.focused) this.goTo(card);
  }

  pointerCancel(pointerId: number) {
    if (pointerId !== this.drag.pointerId) return;
    if (this.drag.active) this.release(0);
    else this.endDrag();
  }

  private release(velocityOverride?: number) {
    const d = this.drag;
    trimSamples(d.samples, performance.now());
    const velocity = velocityOverride ?? sampleVelocity(d.samples);
    const { index, duration } = releaseTarget(d.startIndex, d.index, velocity, this.maxIndex, this.reduced);
    const from = d.index;
    this.endDrag();
    this.startGlide(from, index, duration);
  }

  private endDrag() {
    const wasActive = this.drag.active;
    this.drag = idleDrag();
    if (wasActive) {
      delete this.els.stage.dataset.dragging;
      this.cb.onDragChange(false);
    }
  }

  // ── Frame loop ──────────────────────────────────────────────────────────

  private wake() {
    if (this.raf || this.disposed) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private frame = (now: number) => {
    this.raf = 0;
    const m = this.metrics;
    if (!m || this.disposed) return;
    const dt = Math.min(64, Math.max(0, now - this.last));
    this.last = now;

    const { progress, slides, entryStart, exitEnd } = this.input;
    const max = this.maxIndex;
    const snap = !this.started || this.reduced;

    // A glide scrolls the page; the train follows the scroll like any other.
    if (this.glide && !this.isActive()) this.glide = null;
    const glided = this.glideIndex(now);
    if (glided !== null) this.scrollTo(glided);

    const target = clamp(this.scrollIndex(), 0, max);
    const entryT = linearBeatProgress(progress, { start: entryStart, end: slides.start });
    const exitT = linearBeatProgress(progress, { start: slides.end, end: exitEnd });
    this.entry = snap ? entryT : damp(this.entry, entryT, TRAIN.phaseMs, dt);
    this.exit = snap ? exitT : damp(this.exit, exitT, TRAIN.phaseMs, dt);

    const before = this.visual;
    if (this.drag.active) this.visual = this.drag.index;
    else if (snap) this.visual = target;
    else this.visual = damp(this.visual, target, TRAIN.settleMs, dt);
    if (this.visual !== before && !this.drag.active && now - this.lastHoverCheck >= HOVER_RECHECK_MS) {
      this.lastHoverCheck = now;
      this.cb.onMovedUnderPointer();
    }

    const along = max > 0 ? this.visual / max : 0;
    if (snap) {
      this.velocity.prev = along;
      this.velocity.target = 0;
      this.velocity.value = 0;
    } else {
      stepVelocity(this.velocity, along, dt / 1000);
      if (Math.abs(this.velocity.value) < 1e-4 && Math.abs(this.velocity.target) < 1e-4) {
        this.velocity.value = 0;
        this.velocity.target = 0;
      }
    }

    // Name a new focused slide only once the train is well into it.
    const settledIndex = clamp(this.visual, 0, max);
    if (this.focused < 0 || Math.abs(settledIndex - this.focused) >= 0.7) {
      const next = Math.round(settledIndex);
      if (next !== this.focused) {
        this.focused = next;
        this.cb.onFocusChange(next);
      }
    }

    const enter = entryOffsets(this.entry, m, this.reduced);
    const leave = exitOffsets(this.exit, this.reduced);
    const opacity = enter.opacity * leave.opacity;
    const visible = opacity > 0.001;
    const interactive = opacity > 0.5 && progress >= 0 && progress < 1;

    if (visible !== this.visible) {
      this.visible = visible;
      this.els.stage.style.visibility = visible ? "visible" : "hidden";
      this.cb.onVisibleChange(visible);
    }
    if (interactive !== this.interactive) {
      this.interactive = interactive;
      this.els.stage.dataset.interactive = String(interactive);
      if (!interactive) {
        this.glide = null;
        this.endDrag();
      }
      this.cb.onInteractiveChange(interactive);
    }
    this.els.stage.style.opacity = opacity.toFixed(3);

    let focusSettled = true;
    if (visible) {
      const offsets = { x: enter.x, z: enter.z, exitLocal: leave.exitLocal };
      const left = m.vw / 2 - m.cardW / 2;
      const top = m.originY - m.cardH / 2;
      for (let i = 0; i <= max; i++) {
        const el = this.els.cards[i];
        if (!el) continue;
        const pose = slidePose(i, this.visual, this.velocity.value, m, offsets);
        // Generous margin: perspective can make a near card overhang its box.
        const shown = Math.abs(pose.x) < m.vw / 2 + m.cardW * 1.25;
        if (shown !== this.onScreen[i]) {
          this.onScreen[i] = shown;
          el.style.visibility = shown ? "" : "hidden";
        }
        el.style.transform =
          `translate3d(${px(left + pose.x)}, ${px(top + pose.y)}, ${px(pose.z)}) ` +
          `rotateY(${pose.rotY.toFixed(2)}deg) scale(${pose.scale.toFixed(4)})`;
        el.style.zIndex = String(1000 + Math.round(pose.focus * 100));
        const f = snap ? pose.focus : damp(this.focusValues[i], pose.focus, TRAIN.focusMs, dt);
        if (f !== this.focusValues[i]) {
          this.focusValues[i] = f;
          el.style.setProperty("--focus", f.toFixed(3));
        }
        if (f !== pose.focus) focusSettled = false;
      }
    }

    this.started = true;
    const settled =
      !this.drag.active &&
      !this.glide &&
      this.visual === target &&
      this.entry === entryT &&
      this.exit === exitT &&
      this.velocity.value === 0 &&
      focusSettled;
    if (!settled) this.wake();
  };
}
