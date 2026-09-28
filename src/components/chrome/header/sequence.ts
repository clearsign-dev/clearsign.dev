// A small keyframe sequencer over the Web Animations API. Every track is a set
// of paused animations placed on one shared clock (start offset, optional
// stagger); the clock is driven by requestAnimationFrame so the whole group
// can play forward, run backwards at a different speed, or jump to either end.

type TrackOptions = {
  duration: number;
  easing: string;
  /** Used when the sequence runs backwards from its end. */
  reverseEasing?: string;
  start?: number;
  stagger?: number;
};

type Track = {
  animations: Animation[];
  duration: number;
  start: number;
  stagger: number;
  easing: string;
  reverseEasing: string;
  applied: number[];
};

// A long main-thread stall must not teleport the clock past the whole
// sequence; it plays slower through the stall instead.
const MAX_STEP_MS = 50;

export class Sequence {
  /** Playback speed multiplier. */
  speed = 1;
  onReverseComplete: (() => void) | null = null;

  private tracks: Track[] = [];
  private total = 0;
  private time = 0;
  private direction: 1 | -1 = 1;
  private frame = 0;
  private lastTick = 0;

  add(targets: Element | Iterable<Element> | null | undefined, keyframes: Keyframe[], options: TrackOptions): this {
    if (!targets) return this;
    const list = targets instanceof Element ? [targets] : Array.from(targets);
    if (list.length === 0) return this;
    const start = options.start ?? 0;
    const stagger = options.stagger ?? 0;
    const animations = list.map((element) => {
      const animation = element.animate(keyframes, {
        duration: options.duration,
        easing: options.easing,
        fill: "both",
      });
      animation.pause();
      animation.currentTime = 0;
      return animation;
    });
    this.tracks.push({
      animations,
      duration: options.duration,
      start,
      stagger,
      easing: options.easing,
      reverseEasing: options.reverseEasing ?? options.easing,
      applied: animations.map(() => 0),
    });
    this.total = Math.max(this.total, start + stagger * (list.length - 1) + options.duration);
    return this;
  }

  play() {
    if (this.time <= 0) this.useEasing("forward");
    this.direction = 1;
    this.run();
  }

  reverse() {
    if (this.time >= this.total) this.useEasing("reverse");
    this.direction = -1;
    this.run();
  }

  /** Jump to 0..1 without animating. */
  seek(progress: number) {
    this.stop();
    this.time = Math.max(0, Math.min(1, progress)) * this.total;
    this.apply();
  }

  destroy() {
    this.stop();
    for (const track of this.tracks) track.animations.forEach((a) => a.cancel());
    this.tracks = [];
    this.total = 0;
    this.time = 0;
  }

  private run() {
    if (this.frame) return;
    this.lastTick = performance.now();
    const step = (now: number) => {
      const elapsed = Math.min(Math.max(now - this.lastTick, 0), MAX_STEP_MS) * this.speed;
      this.lastTick = now;
      this.time = Math.max(0, Math.min(this.total, this.time + elapsed * this.direction));
      this.apply();
      if (this.direction === 1 && this.time >= this.total) {
        this.frame = 0;
        return;
      }
      if (this.direction === -1 && this.time <= 0) {
        this.frame = 0;
        this.onReverseComplete?.();
        return;
      }
      this.frame = requestAnimationFrame(step);
    };
    this.frame = requestAnimationFrame(step);
  }

  private stop() {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private apply() {
    for (const track of this.tracks) {
      track.animations.forEach((animation, i) => {
        const local = Math.max(0, Math.min(track.duration, this.time - (track.start + track.stagger * i)));
        if (track.applied[i] === local) return;
        track.applied[i] = local;
        animation.currentTime = local;
      });
    }
  }

  private useEasing(direction: "forward" | "reverse") {
    for (const track of this.tracks) {
      const easing = direction === "forward" ? track.easing : track.reverseEasing;
      track.animations.forEach((animation) => animation.effect?.updateTiming({ easing }));
    }
  }
}
