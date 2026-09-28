// The rhythm game: bytes fall down four lanes toward a signing line and are
// read by pressing their lane as they cross it. The AudioContext clock decides
// every time here; frames only draw what that clock says.

import { AudioEngine, type SfxName } from "./audio";
import { LANE_COUNT, type Fx, type LaneFx, type Note, type SceneState, type Spark } from "./model";
import { mix, readPalette, type Palette, type RGB } from "./palette";
import {
  NOTES_PER_MINUTE_PER_DENSITY,
  WARMUP_DENSITY,
  WARMUP_STEPS,
  axesForStep,
  stageForStep,
  type Axes,
} from "./progression";
import { computeLayout, drawScene, laneFromPoint, laneWidthAt, laneXAt, padSize, yAt, type Layout } from "./render";
import { readBest, readSettings, saveBest, type Best } from "./storage";
import {
  beatSeconds,
  chartFor,
  chartGate,
  introSteps,
  loopSteps,
  newLaneWalk,
  partnerLane,
  stepSeconds,
  stepTime,
  trackById,
  walkLane,
  type Chart,
  type LaneWalk,
  type Track,
} from "./tracks";
import type { GameCallbacks, HudState, PopupSpec, RunEndReason } from "./types";

export const KEY_TO_LANE: Readonly<Record<string, number>> = {
  d: 0,
  f: 1,
  j: 2,
  k: 3,
  "1": 0,
  "2": 1,
  "3": 2,
  "4": 3,
};
export const PAD_KEYS = ["D/1", "F/2", "J/3", "K/4"] as const;
export const MAX_LIVES = 3;

const LIFE_EVERY = 25;
const BASE_TRAVEL_SEC = 2.6;
const BASE_WINDOW_SEC = 0.18;
const MIN_WINDOW_SCALE = 0.684;
const MIN_WINDOW_SEC = 0.07;
const PERFECT_SHARE = 0.28;
const APPROACH_WINDOWS = 2.65;
const HOLD_TICK_SEC = 0.16;
const HOLD_BONUS = 5;
const RELEASE_GRACE_SEC = 0.1;
const REVEAL_SEC = 1.15;
const DIM_SEC = 0.6;
const MIN_LANE_GAP_SEC = 0.16;
/** Chords go to the strongest share of admitted bytes only. */
const CHORD_SHARE = 0.25;
/** Beats between the starts of two holds. */
const HOLD_SPACING_BEATS = 6;
const COMBO_ARC_FROM = 6;
const SPARK_CAP = 140;
const SELECTORS = ["a9059cbb", "095ea7b3", "23b872dd", "2e1a7d4d", "d0e30db0", "38ed1739"];

const clamp01 = (v: number) => (v <= 0 ? 0 : v >= 1 ? 1 : v);
const isMilestone = (c: number) => c === 10 || c === 25 || c === 50 || (c >= 100 && c % 100 === 0);

function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Calldata-shaped bytes: a selector, then argument bytes. */
class ByteStream {
  private queue: string[] = [];
  private first = true;
  constructor(private rand: () => number) {}

  next(): string {
    if (this.queue.length === 0) this.refill();
    return this.queue.shift()!;
  }

  private refill() {
    const selector = this.first ? SELECTORS[0] : SELECTORS[Math.floor(this.rand() * SELECTORS.length)];
    this.first = false;
    for (let i = 0; i < 8; i += 2) this.queue.push(selector.slice(i, i + 2));
    const args = 20 + Math.floor(this.rand() * 8);
    for (let i = 0; i < args; i++) {
      this.queue.push((1 + Math.floor(this.rand() * 255)).toString(16).padStart(2, "0"));
    }
  }
}

interface Hold {
  note: Note;
  source: string;
  ticks: number;
}

interface Run {
  track: Track;
  chart: Chart;
  t0: number;
  /** Clock time the run started; spawning opens REVEAL_SEC later. */
  startedAt: number;
  spawning: boolean;
  nextStep: number;
  beatBase: number;
  walk: LaneWalk;
  lastHoldAt: number;
}

function newLane(): LaneFx {
  return { press: 0, pulse: 0, approach: 0, missFlash: 0, force: 0, noNote: false, coreFill: 0, corePulse: 0, pop: 0 };
}

export class VoidHeroGame {
  private readonly g: CanvasRenderingContext2D;
  private readonly palette: Palette;
  private layout: Layout;
  private readonly audio: AudioEngine;
  private readonly motionQuery: MediaQueryList | null;
  private reducedMotion: boolean;
  private raf = 0;
  private lastFrame = 0;
  private destroyed = false;

  private mode: "ready" | "playing" | "ended" = "ready";
  private paused = false;
  private track: Track;
  private run: Run | null = null;
  /** Beat grid of whatever is sounding (a run or a preview), for the lines. */
  private grid: { t0: number; beatSec: number } | null = null;

  private notes: Note[] = [];
  private holding: (Hold | null)[] = new Array(LANE_COUNT).fill(null);
  private laneDownCount: number[] = new Array(LANE_COUNT).fill(0);
  private laneFreeAt: number[] = new Array(LANE_COUNT).fill(-Infinity);
  private pointerLanes = new Map<number, number>();
  private lanes: LaneFx[] = Array.from({ length: LANE_COUNT }, newLane);
  private fx: Fx[] = [];
  private sparks: Spark[] = [];
  private bytes = new ByteStream(seededRandom(1));

  private score = 0;
  private combo = 0;
  private maxCombo = 0;
  private lives = MAX_LIVES;
  private lifeTier = 0;
  private readCount = 0;
  private blindCount = 0;
  private totalSteps = 0;
  private axes: Axes = axesForStep(0);
  private stageName = "";
  private best: Best;
  private hudDirty = true;
  private anyInput = false;
  private hintShown = false;

  private reveal = 0;
  private dim = 0;
  private dimTarget = 0;
  private critical = false;
  private beat = 0;
  private flash = 0;
  private shake = 0;
  private elapsed = 0;

  private readonly scene: SceneState;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly cb: GameCallbacks,
  ) {
    const g = canvas.getContext("2d");
    if (!g) throw new Error("2D canvas unavailable");
    this.g = g;
    this.palette = readPalette(document.documentElement);
    const settings = readSettings();
    this.track = trackById(settings.trackId);
    this.audio = new AudioEngine(settings.volume, settings.muted);
    this.best = readBest();
    this.motionQuery = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    this.reducedMotion = this.motionQuery?.matches ?? false;
    if (this.reducedMotion) this.reveal = 1;
    this.layout = this.measure();

    this.scene = {
      reveal: 0,
      dim: 0,
      critical: false,
      beat: 0,
      flash: 0,
      now: 0,
      travel: BASE_TRAVEL_SEC,
      elapsed: 0,
      grid: null,
      notes: this.notes,
      lanes: this.lanes,
      fx: this.fx,
      sparks: this.sparks,
      shakeX: 0,
      shakeY: 0,
      showSignLabel: true,
    };

    window.addEventListener("resize", this.onResize);
    window.addEventListener("blur", this.onBlur);
    window.addEventListener("contextmenu", this.onContextMenu);
    document.addEventListener("visibilitychange", this.onVisibility);
    this.motionQuery?.addEventListener("change", this.onMotionChange);

    this.emitPadLabels();
    this.emitHud();
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  // ------------------------------------------------------------ public API

  get isPaused(): boolean {
    return this.paused;
  }

  get isMuted(): boolean {
    return this.audio.isMuted;
  }

  start() {
    if (this.destroyed) return;
    this.audio.ensure();
    void this.audio.resume();

    this.mode = "playing";
    this.paused = false;
    this.critical = false;
    this.dimTarget = 0;
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lives = MAX_LIVES;
    this.lifeTier = 0;
    this.readCount = 0;
    this.blindCount = 0;
    this.totalSteps = 0;
    this.axes = axesForStep(0);
    this.stageName = this.axes.stage.name;
    this.anyInput = false;
    this.hintShown = false;
    this.notes.length = 0;
    this.fx.length = 0;
    this.sparks.length = 0;
    this.holding.fill(null);
    this.laneDownCount.fill(0);
    this.laneFreeAt.fill(-Infinity);
    this.pointerLanes.clear();
    this.bytes = new ByteStream(seededRandom((Math.random() * 2 ** 32) >>> 0));

    const track = this.track;
    const t0 = this.audio.startTrack(track, 0);
    this.run = {
      track,
      chart: chartFor(track),
      t0,
      startedAt: this.audio.now(),
      spawning: false,
      nextStep: 0,
      beatBase: 0,
      walk: newLaneWalk(),
      lastHoldAt: -Infinity,
    };
    this.grid = { t0, beatSec: beatSeconds(track) };
    this.lanes.forEach((lane, i) => {
      lane.pulse = 1 - i * 0.15;
    });
    this.sfx("intro");
    this.hudDirty = true;
    this.emitPadLabels();
  }

  /** Ends the current run from the UI ("End run"). */
  endRun() {
    this.finish("quit");
  }

  setPaused(paused: boolean) {
    if (this.mode !== "playing" || this.paused === paused) return;
    this.paused = paused;
    if (paused) {
      this.releaseEverything();
      void this.audio.suspend();
    } else {
      void this.audio.resume();
    }
    this.cb.onPause(paused);
  }

  setTrack(id: string) {
    const track = trackById(id);
    const same = track.id === this.track.id;
    this.track = track;

    if (this.mode === "playing" && this.run) {
      if (same) return;
      const now = this.audio.now();
      this.dropInFlight(now);
      const startStep = introSteps(track);
      const t0 = this.audio.startTrack(track, startStep);
      const horizon = now + this.travel();
      const run = this.run;
      run.track = track;
      run.chart = chartFor(track);
      run.t0 = t0;
      run.nextStep = this.firstStepAfter(track, t0, horizon, startStep);
      run.beatBase = Math.floor((horizon - t0) / beatSeconds(track)) - this.totalSteps;
      this.laneFreeAt.fill(-Infinity);
      this.grid = { t0, beatSec: beatSeconds(track) };
      return;
    }

    // Ready or ended: play the track as a preview (a click is the gesture).
    if (same && this.audio.trackPlaying) return;
    if (!this.audio.ensure()) return;
    void this.audio.resume();
    const t0 = this.audio.startTrack(track, introSteps(track));
    this.grid = { t0, beatSec: beatSeconds(track) };
  }

  setVolume(volume: number) {
    this.audio.setVolume(volume);
  }

  setMuted(muted: boolean) {
    this.audio.setMuted(muted);
  }

  laneDown(lane: number, source: string, eventStamp?: number) {
    if (this.mode !== "playing" || this.paused) return;
    this.laneDownCount[lane] += 1;
    if (!this.anyInput) {
      this.anyInput = true;
      if (this.hintShown) this.cb.onHint(null);
    }
    if (this.holding[lane]) return;

    const fx = this.lanes[lane];
    fx.press = 1;
    fx.pulse = 1;

    const now = this.audio.now();
    const lag = eventStamp === undefined ? 0 : Math.min(0.1, Math.max(0, (performance.now() - eventStamp) / 1000));
    const t = now - lag;

    let best: Note | null = null;
    let bestDelta = Infinity;
    for (const n of this.notes) {
      if (n.lane !== lane || n.state !== "live") continue;
      const d = Math.abs(t - n.hitTime);
      if (d < bestDelta) {
        bestDelta = d;
        best = n;
      }
    }

    const reach = this.goodWindow();
    if (best && bestDelta <= reach) {
      fx.noNote = false;
      const perfect = bestDelta <= reach * PERFECT_SHARE;
      this.combo += 1;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      this.readCount += 1;
      this.score += this.scored(perfect ? 2 : 1);
      this.regainLife();
      this.hitBurst(lane, perfect);
      this.sfx(perfect ? "perfect" : "nice");
      this.shakeBy(perfect ? 1 : 0.5);
      if (perfect) fx.pop = 1;
      this.hitPopup(lane, perfect);
      this.comboFx(lane, perfect);
      if (this.combo % 10 === 0) this.sfx("milestone");

      if (best.holdSec > 0) {
        best.state = "held";
        best.headHit = true;
        best.changedAt = now;
        this.holding[lane] = { note: best, source, ticks: 0 };
      } else {
        best.state = "read";
        best.changedAt = now;
      }
      this.hudDirty = true;
      return;
    }

    // Nothing in reach: an early (or stray) press.
    this.combo = 0;
    this.lifeTier = 0;
    fx.missFlash = 1;
    fx.noNote = true;
    this.sfx("early");
    this.popup("Early", "judgment", "ink", laneXAt(this.layout, lane, 0), this.layout.hitY - padSize(this.layout).h * 2.2);
    this.hudDirty = true;
  }

  laneUp(lane: number, source: string) {
    this.laneDownCount[lane] = Math.max(0, this.laneDownCount[lane] - 1);
    if (this.laneDownCount[lane] === 0) this.lanes[lane].noNote = false;
    if (this.mode !== "playing" || this.paused) return;
    const hold = this.holding[lane];
    if (!hold || hold.source !== source) return;
    const now = this.audio.now();
    if (now >= hold.note.endTime - RELEASE_GRACE_SEC) this.completeHold(lane, now);
    else this.breakHold(lane, now);
  }

  pointerDown(event: PointerEvent) {
    if (this.mode !== "playing" || this.paused) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const lane = laneFromPoint(this.layout, event.clientX, event.clientY);
    this.pointerLanes.set(event.pointerId, lane);
    this.laneDown(lane, `pointer:${event.pointerId}`, event.timeStamp);
  }

  pointerUp(event: PointerEvent) {
    const lane = this.pointerLanes.get(event.pointerId);
    if (lane === undefined) return;
    this.pointerLanes.delete(event.pointerId);
    this.laneUp(lane, `pointer:${event.pointerId}`);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this.onResize);
    window.removeEventListener("blur", this.onBlur);
    window.removeEventListener("contextmenu", this.onContextMenu);
    document.removeEventListener("visibilitychange", this.onVisibility);
    this.motionQuery?.removeEventListener("change", this.onMotionChange);
    this.audio.stopTrack(0.05);
    this.audio.destroy();
    this.run = null;
    this.notes.length = 0;
  }

  // ------------------------------------------------------------ rules

  private travel(): number {
    return BASE_TRAVEL_SEC / this.axes.speedMul;
  }

  /** The reference's distance window, in seconds: it narrows as bytes speed up. */
  private goodWindow(): number {
    const scale = Math.max(MIN_WINDOW_SCALE, this.axes.windowScale);
    return Math.max(MIN_WINDOW_SEC, (BASE_WINDOW_SEC * scale) / this.axes.speedMul);
  }

  private scored(base: number): number {
    return Math.max(1, Math.round(base * this.axes.scoreMul));
  }

  private regainLife() {
    const tier = Math.floor(this.combo / LIFE_EVERY);
    if (tier <= this.lifeTier) return;
    this.lifeTier = tier;
    if (this.lives >= MAX_LIVES) return;
    this.lives += 1;
    this.popup("+1 heart", "milestone", "accent", this.layout.cx, this.layout.hitY - (this.layout.hitY - this.layout.farY) * 0.25);
    this.sfx("milestone");
  }

  private penalty() {
    if (this.mode !== "playing") return;
    this.combo = 0;
    this.lifeTier = 0;
    this.lives = Math.max(0, this.lives - 1);
    this.shakeBy(0.35);
    this.sfx("heart");
    this.hudDirty = true;
    if (this.lives <= 0) this.finish("hearts");
  }

  private goBlind(note: Note, now: number) {
    note.state = "blind";
    note.changedAt = now;
    this.blindCount += 1;
    const L = this.layout;
    this.popup("Blind", "judgment", "blind", laneXAt(L, note.lane, 0), L.hitY - padSize(L).h * 2.2);
    this.missBurst(note.lane);
    this.shakeBy(0.2);
    this.sfx("blind");
    this.penalty();
    if (!this.anyInput && !this.hintShown && this.blindCount >= 2 && this.mode === "playing") {
      this.hintShown = true;
      this.cb.onHint("keys");
    }
  }

  private completeHold(lane: number, now: number) {
    const hold = this.holding[lane];
    if (!hold) return;
    this.holding[lane] = null;
    hold.note.state = "read";
    hold.note.changedAt = now;
    this.score += this.scored(HOLD_BONUS);
    const L = this.layout;
    this.popup("Complete", "milestone", "accent", laneXAt(L, lane, 0), L.hitY - padSize(L).h * 2.6);
    this.sfx("complete");
    this.shakeBy(1.2);
    this.hudDirty = true;
  }

  private breakHold(lane: number, now: number) {
    const hold = this.holding[lane];
    if (!hold) return;
    this.holding[lane] = null;
    hold.note.state = "blind";
    hold.note.changedAt = now;
    const L = this.layout;
    this.popup("Let go", "judgment", "blind", laneXAt(L, lane, 0), L.hitY - padSize(L).h * 2.2);
    this.sfx("blind");
    this.shakeBy(0.4);
    this.penalty();
  }

  /** Blur, pause or a context menu: holds end without penalty, keys are up. */
  private releaseEverything() {
    this.laneDownCount.fill(0);
    this.pointerLanes.clear();
    for (const lane of this.lanes) lane.noNote = false;
    const now = this.audio.now();
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const hold = this.holding[lane];
      if (!hold) continue;
      if (now >= hold.note.endTime - RELEASE_GRACE_SEC) {
        this.completeHold(lane, now);
      } else {
        this.holding[lane] = null;
        hold.note.state = "dropped";
        hold.note.changedAt = now;
      }
    }
  }

  private dropInFlight(now: number) {
    this.holding.fill(null);
    for (const n of this.notes) {
      if (n.state === "live" || n.state === "held") {
        n.state = "dropped";
        n.changedAt = now;
      }
    }
  }

  private finish(reason: RunEndReason) {
    if (this.mode !== "playing") return;
    const now = this.audio.now();
    if (this.paused) {
      this.paused = false;
      void this.audio.resume();
      this.cb.onPause(false);
    }
    this.mode = "ended";
    this.critical = reason === "hearts";
    this.dimTarget = 1;

    const newBest = this.score > this.best.score;
    this.best = {
      score: Math.max(this.best.score, this.score),
      steps: Math.max(this.best.steps, this.totalSteps),
    };
    saveBest(this.best);

    this.laneDownCount.fill(0);
    this.pointerLanes.clear();
    this.holding.fill(null);
    for (const n of this.notes) {
      if (n.state === "live" || n.state === "held") {
        n.state = reason === "hearts" ? "blind" : "dropped";
        n.changedAt = now;
      }
    }
    this.audio.stopTrack(reason === "hearts" ? 0.25 : 0.5);
    this.run = null;
    if (reason === "hearts") this.sfx("over");

    this.hudDirty = true;
    this.cb.onHint(null);
    this.cb.onRunEnd({
      reason,
      score: this.score,
      stageName: this.stageName,
      read: this.readCount,
      blind: this.blindCount,
      maxCombo: this.maxCombo,
      bestScore: this.best.score,
      bestStage: stageForStep(this.best.steps).name,
      newBest: newBest && this.score > 0,
    });
  }

  // ------------------------------------------------------------ the clock

  private frame = (perfMs: number) => {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.min(0.05, Math.max(0, (perfMs - this.lastFrame) / 1000));
    this.lastFrame = perfMs;
    this.tick(dt);
    this.draw();
  };

  private tick(dt: number) {
    this.audio.pump();
    const now = this.audio.now();
    const vdt = this.paused ? 0 : dt;
    this.elapsed += vdt;

    this.reveal = Math.min(1, this.reveal + dt / REVEAL_SEC);
    const dimStep = dt / DIM_SEC;
    this.dim = this.dim < this.dimTarget ? Math.min(this.dimTarget, this.dim + dimStep) : Math.max(this.dimTarget, this.dim - dimStep);

    const kick = this.audio.takeKick(now);
    if (kick > 0) this.beat = Math.max(this.beat, kick);
    this.beat = Math.max(0, this.beat - vdt * 5.5);
    if (!this.audio.trackPlaying && this.mode !== "playing") this.grid = null;

    if (this.mode === "playing" && !this.paused && this.run) {
      this.advance(now);
      if (this.mode === "playing") this.judgeLate(now);
      if (this.mode === "playing") this.tickHolds(now);
    }

    this.updateLanes(vdt, now);
    this.updateFx(vdt);
    this.prune(now);

    this.shake = this.shake > 0.005 ? this.shake * Math.pow(0.0015, vdt) : 0;
    this.flash = Math.max(0, this.flash - vdt * 4);

    if (this.hudDirty) {
      this.hudDirty = false;
      this.emitHud();
    }
  }

  private firstStepAfter(track: Track, t0: number, time: number, min: number): number {
    const d = stepSeconds(track);
    let i = Math.max(min, Math.ceil((time - t0) / d) - 1);
    while (stepTime(track, t0, i) <= time) i++;
    return i;
  }

  /** Stage progression and spawning, both measured at the spawn horizon. */
  private advance(now: number) {
    const run = this.run!;
    const track = run.track;
    const beat = beatSeconds(track);

    if (!run.spawning) {
      if (now - run.startedAt < REVEAL_SEC) return;
      run.spawning = true;
      const horizon = now + this.travel();
      run.nextStep = this.firstStepAfter(track, run.t0, horizon, introSteps(track));
      run.beatBase = Math.floor((horizon - run.t0) / beat) - this.totalSteps;
    }

    const horizonForSteps = now + this.travel();
    const steps = Math.floor((horizonForSteps - run.t0) / beat) - run.beatBase;
    while (this.totalSteps < steps) {
      this.totalSteps += 1;
      this.axes = axesForStep(this.totalSteps);
      if (this.axes.stage.name !== this.stageName) {
        this.stageName = this.axes.stage.name;
        this.stageBanner();
      }
      this.hudDirty = true;
    }

    const horizon = now + this.travel();
    const intro = introSteps(track);
    const loop = loopSteps(track);
    const gap = Math.max(MIN_LANE_GAP_SEC, stepSeconds(track) * 1.5);
    const stage = this.axes.stage;
    const density = this.totalSteps < WARMUP_STEPS ? Math.min(this.axes.density, WARMUP_DENSITY) : this.axes.density;
    const gate = chartGate(run.chart, density, NOTES_PER_MINUTE_PER_DENSITY);
    const chordGate = chartGate(run.chart, density * CHORD_SHARE, NOTES_PER_MINUTE_PER_DENSITY);
    const holdSpacing = HOLD_SPACING_BEATS * beat;

    let guard = 64;
    while (guard-- > 0) {
      const i = run.nextStep;
      const t = stepTime(track, run.t0, i);
      if (t > horizon) break;
      run.nextStep += 1;
      if (i < intro) continue;
      const cand = run.chart.steps[(i - intro) % loop];
      if (!cand || cand.salience < gate) continue;
      const lane = this.freeLane(walkLane(run.walk, cand), t, -1, gap);
      if (lane < 0) continue;
      run.walk.lane = lane;
      if (cand.pitch !== null) run.walk.pitch = cand.pitch;
      const hold = stage.holds && cand.holdSec > 0 && t - run.lastHoldAt >= holdSpacing ? cand.holdSec : 0;
      if (hold > 0) run.lastHoldAt = t;
      const first = this.addNote(lane, t, hold);
      if (cand.partner && stage.chords && cand.salience >= chordGate) {
        const other = this.freeLane(partnerLane(lane), t, lane, gap);
        if (other >= 0) {
          const second = this.addNote(other, t, 0);
          first.partner = second;
          second.partner = first;
        }
      }
    }
  }

  private freeLane(preferred: number, t: number, exclude: number, gap: number): number {
    for (let d = 0; d < LANE_COUNT; d++) {
      for (const lane of d === 0 ? [preferred] : [preferred + d, preferred - d]) {
        if (lane < 0 || lane >= LANE_COUNT || lane === exclude) continue;
        if (this.laneFreeAt[lane] + gap <= t) return lane;
      }
    }
    return -1;
  }

  private addNote(lane: number, hitTime: number, holdSec: number): Note {
    const note: Note = {
      lane,
      hitTime,
      holdSec,
      endTime: hitTime + holdSec,
      hex: this.bytes.next(),
      state: "live",
      headHit: false,
      changedAt: hitTime,
      partner: null,
    };
    this.laneFreeAt[lane] = hitTime + holdSec;
    this.notes.push(note);
    return note;
  }

  private judgeLate(now: number) {
    const reach = this.goodWindow();
    for (const n of this.notes) {
      if (n.state !== "live" || now - n.hitTime <= reach) continue;
      this.goBlind(n, now);
      if (this.mode !== "playing") return;
    }
  }

  private tickHolds(now: number) {
    for (let lane = 0; lane < LANE_COUNT; lane++) {
      const hold = this.holding[lane];
      if (!hold) continue;
      const until = Math.min(now, hold.note.endTime);
      const ticks = Math.floor(Math.max(0, until - hold.note.hitTime) / HOLD_TICK_SEC);
      if (ticks > hold.ticks) {
        this.score += this.scored(1) * (ticks - hold.ticks);
        hold.ticks = ticks;
        this.lanes[lane].corePulse = 1;
        this.hudDirty = true;
      }
      this.lanes[lane].press = Math.max(this.lanes[lane].press, 0.9);
      if (now >= hold.note.endTime) this.completeHold(lane, now);
    }
  }

  private prune(now: number) {
    let w = 0;
    for (let r = 0; r < this.notes.length; r++) {
      const n = this.notes[r];
      const age = now - n.changedAt;
      const gone =
        (n.state === "read" && age > 0.3) ||
        (n.state === "dropped" && age > 0.3) ||
        (n.state === "blind" && age > 0.55);
      if (!gone) this.notes[w++] = n;
      else if (n.partner) n.partner.partner = null;
    }
    this.notes.length = w;
  }

  // ------------------------------------------------------------ feel

  private updateLanes(dt: number, now: number) {
    const travel = this.travel();
    const approachZ = (APPROACH_WINDOWS * this.goodWindow()) / travel;
    for (const lane of this.lanes) lane.approach = 0;
    for (const n of this.notes) {
      if (n.state !== "live") continue;
      const z = (n.hitTime - now) / travel;
      if (z > 0 && z < approachZ) {
        const lane = this.lanes[n.lane];
        lane.approach = Math.max(lane.approach, 1 - z / approachZ);
      }
    }
    for (let i = 0; i < LANE_COUNT; i++) {
      const lane = this.lanes[i];
      const target = this.laneDownCount[i] > 0 ? 1 : 0;
      const rate = target > lane.force ? 9 : 20;
      lane.force = clamp01(lane.force + (target - lane.force) * Math.min(1, rate * dt));
      lane.press = Math.max(0, lane.press - dt * 4.5);
      lane.pulse = Math.max(0, lane.pulse - dt * 3.2);
      lane.missFlash = Math.max(0, lane.missFlash - dt * 4.5);
      lane.corePulse = Math.max(0, lane.corePulse - dt * 6);
      lane.pop *= Math.exp(-dt * 14);
      lane.coreFill += ((this.holding[i] ? 1 : 0) - lane.coreFill) * Math.min(1, dt * 10);
    }
  }

  private updateFx(dt: number) {
    let w = 0;
    for (const f of this.fx) {
      f.life += dt;
      if (f.life < f.max) this.fx[w++] = f;
    }
    this.fx.length = w;

    w = 0;
    for (const s of this.sparks) {
      s.life += dt;
      if (s.life >= s.max) continue;
      s.vy += 720 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      this.sparks[w++] = s;
    }
    this.sparks.length = w;
  }

  private shakeBy(intensity: number) {
    if (this.reducedMotion) return;
    this.shake = Math.max(this.shake, intensity);
  }

  private tierColor(): RGB {
    const P = this.palette;
    if (this.combo >= 100) return mix(P.accent, P.ink, 0.5);
    if (this.combo >= 25) return P.accent;
    return P.ink;
  }

  private hitBurst(lane: number, perfect: boolean) {
    const L = this.layout;
    const pad = padSize(L);
    const color = this.tierColor();
    this.fx.push({
      kind: "ring",
      lane,
      life: 0,
      max: 0.45,
      color,
      big: perfect,
      alpha: 1,
      w0: pad.w,
      w1: pad.w * (perfect ? 1.6 : 1.35),
      h0: pad.h,
      h1: pad.h * (perfect ? 2.3 : 1.8),
    });
    this.fx.push({ kind: "beam", lane, life: 0, max: 0.32, color, big: perfect, alpha: 0.55, w0: 0, w1: 0, h0: 0, h1: 0 });

    const count = (perfect ? 14 : 10) >> (this.reducedMotion ? 1 : 0);
    const x = laneXAt(L, lane, 0);
    for (let i = 0; i < count && this.sparks.length < SPARK_CAP; i++) {
      this.sparks.push({
        x: x + (Math.random() - 0.5) * pad.w * 0.6,
        y: L.hitY - pad.h * 0.3,
        vx: (Math.random() - 0.5) * 220,
        vy: -(140 + Math.random() * 260),
        life: 0,
        max: 0.3 + Math.random() * 0.25,
        char: "0123456789abcdef"[Math.floor(Math.random() * 16)],
        color: Math.random() < 0.5 ? this.palette.accent : color,
        size: 9 + Math.floor(Math.random() * 5),
      });
    }
  }

  private missBurst(lane: number) {
    const pad = padSize(this.layout);
    this.fx.push({
      kind: "ring",
      lane,
      life: 0,
      max: 0.32,
      color: this.palette.blind,
      big: false,
      alpha: 0.6,
      w0: pad.w,
      w1: pad.w * 0.5,
      h0: pad.h,
      h1: pad.h * 0.5,
    });
  }

  private comboFx(lane: number, perfect: boolean) {
    if (this.reducedMotion) return;
    const lw = laneWidthAt(this.layout, 0);
    if (isMilestone(this.combo)) {
      const color = this.tierColor();
      this.fx.push({ kind: "bolt", lane, life: 0, max: 0.42, color, big: true, alpha: 1, w0: 0, w1: 0, h0: 0, h1: 0 });
      this.fx.push({ kind: "impact", lane, life: 0, max: 0.34, color, big: true, alpha: 0.9, w0: lw * 0.6, w1: lw * 1.8, h0: 0, h1: 0 });
      this.flash = 1;
    } else if (perfect && this.combo >= COMBO_ARC_FROM) {
      this.fx.push({ kind: "bolt", lane, life: 0, max: 0.22, color: this.palette.accent, big: false, alpha: 0.75, w0: 0, w1: 0, h0: 0, h1: 0 });
    }
  }

  private hitPopup(lane: number, perfect: boolean) {
    const L = this.layout;
    const x = laneXAt(L, lane, 0);
    const y = L.hitY - padSize(L).h * 2.2;
    const c = this.combo;
    if (isMilestone(c)) this.popup(`${c} read`, "milestone", c >= 25 ? "accent" : "ink", x, y);
    else if (c >= 2) this.popup(`x${c}`, "combo", "ink", x, y);
    else this.popup(perfect ? "Perfect" : "Nice", "judgment", "ink", x, y);
  }

  private stageBanner() {
    const L = this.layout;
    this.popup(this.stageName, "milestone", "accent", L.cx, L.hitY - (L.hitY - L.farY) * 0.4);
    this.shakeBy(1.4);
    this.sfx("stage");
  }

  private popup(text: string, tier: PopupSpec["tier"], tone: PopupSpec["tone"], x: number, y: number) {
    this.cb.onPopup({ text, tier, tone, x, y });
  }

  private sfx(name: SfxName) {
    this.audio.sfx(name);
  }

  // ------------------------------------------------------------ output

  private emitHud() {
    const hud: HudState = {
      score: this.score,
      combo: this.combo,
      lives: this.lives,
      maxLives: MAX_LIVES,
      stageName: this.stageName,
      stageProgress: this.axes.progress,
      bestScore: this.best.score,
    };
    this.cb.onHud(hud);
  }

  private emitPadLabels() {
    const L = this.layout;
    const pad = padSize(L);
    this.cb.onPadLabels(
      PAD_KEYS.map((label, i) => ({ label, x: laneXAt(L, i, 0), y: L.hitY + pad.h / 2 + 14 })),
    );
  }

  private measure(): Layout {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const coarse = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    const layout = computeLayout(w, h, dpr, w < 768 || coarse);
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    return layout;
  }

  private draw() {
    const S = this.scene;
    const L = this.layout;
    S.reveal = this.reveal;
    S.dim = this.dim;
    S.critical = this.critical;
    S.beat = this.beat;
    S.flash = this.reducedMotion ? 0 : this.flash;
    S.now = this.audio.now();
    S.travel = this.mode === "playing" ? this.travel() : BASE_TRAVEL_SEC;
    S.elapsed = this.elapsed;
    S.grid = this.mode === "ended" ? null : this.grid;
    if (this.shake > 0 && !this.reducedMotion) {
      S.shakeX = (Math.random() - 0.5) * 7 * this.shake;
      S.shakeY = (Math.random() - 0.5) * 5 * this.shake;
    } else {
      S.shakeX = 0;
      S.shakeY = 0;
    }
    S.showSignLabel = yAt(L, 0) > 0;
    drawScene(this.g, L, this.palette, S);
  }

  // ------------------------------------------------------------ events

  private onResize = () => {
    this.layout = this.measure();
    this.emitPadLabels();
  };

  private onBlur = () => {
    if (this.mode === "playing" && !this.paused) this.setPaused(true);
    else this.releaseEverything();
  };

  private onContextMenu = () => {
    this.releaseEverything();
  };

  private onVisibility = () => {
    if (document.visibilityState === "hidden" && this.mode === "playing" && !this.paused) this.setPaused(true);
  };

  private onMotionChange = (event: MediaQueryListEvent) => {
    this.reducedMotion = event.matches;
    if (event.matches) {
      this.shake = 0;
      this.flash = 0;
    }
  };
}
