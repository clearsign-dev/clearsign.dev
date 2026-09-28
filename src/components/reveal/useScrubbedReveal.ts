"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";

// A staggered set of Web Animations that is either scrubbed to a progress
// value (scroll-driven) or played through in real time (intro-driven).
//
// Timeline maths: target i starts at i * stagger and runs for `duration`, so
// the whole timeline lasts (n - 1) * stagger + duration. Scrubbing sets every
// animation's currentTime to progress * total; WAAPI's own delay handling does
// the rest.

export type RevealKeyframes = (index: number, count: number) => Keyframe[];

export type ScrubbedRevealOptions = {
  /** CSS selector for the animated targets inside the container. */
  selector: string;
  keyframes: RevealKeyframes;
  /** Seconds each target takes. */
  duration: number;
  /** Seconds between consecutive targets. A function lets targets share a start (line mode). */
  stagger: number | ((index: number, targets: HTMLElement[]) => number);
  easing?: string;
  /** Scroll mode: 0..1. Takes precedence over `playing`. */
  progress?: number;
  /** Play mode: true plays forward, false plays back. */
  playing?: boolean;
  /** Play-mode reverse speed multiplier. */
  reverseSpeed?: number;
  /** Raise progress to this power before applying (slows the start of a scrub). */
  progressPower?: number;
  /** Fired once, this many seconds before the timeline ends, when playing forward. */
  onBeforeEnd?: { offset: number; callback: () => void };
  /** Anything that should rebuild the animations when it changes. */
  rebuildKey?: unknown;
};

export function useScrubbedReveal(
  containerRef: RefObject<HTMLElement | null>,
  options: ScrubbedRevealOptions,
) {
  const animationsRef = useRef<Animation[]>([]);
  const totalMsRef = useRef(0);
  const appliedRef = useRef(-1);
  const targetRef = useRef(0);
  const rafRef = useRef(0);
  const optionsRef = useRef(options);
  const firedBeforeEndRef = useRef(false);
  const playRafRef = useRef(0);

  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  const apply = (p: number) => {
    const total = totalMsRef.current;
    appliedRef.current = p;
    const t = p * total;
    for (const anim of animationsRef.current) anim.currentTime = t;
    const before = optionsRef.current.onBeforeEnd;
    if (before && !firedBeforeEndRef.current && t >= total - before.offset * 1000) {
      firedBeforeEndRef.current = true;
      before.callback();
    }
  };

  // Build (and rebuild) the animations.
  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const { selector, keyframes, duration, stagger, easing = "linear" } = optionsRef.current;
    const targets = Array.from(container.querySelectorAll<HTMLElement>(selector));
    const durationMs = duration * 1000;
    let maxDelay = 0;
    animationsRef.current = targets.map((el, i) => {
      const delaySeconds = typeof stagger === "function" ? stagger(i, targets) : i * stagger;
      const delay = delaySeconds * 1000;
      maxDelay = Math.max(maxDelay, delay);
      const anim = el.animate(keyframes(i, targets.length), {
        duration: durationMs,
        delay,
        easing,
        fill: "both",
      });
      anim.pause();
      return anim;
    });
    totalMsRef.current = maxDelay + durationMs;
    appliedRef.current = -1;
    firedBeforeEndRef.current = false;
    // First apply is synchronous and uses the current scroll progress, so a
    // section mounted mid-scroll paints its real state on its first frame.
    const { progress: initial, progressPower = 1 } = optionsRef.current;
    if (typeof initial === "number" && Number.isFinite(initial)) {
      targetRef.current = Math.max(0, Math.min(1, initial)) ** progressPower;
    }
    apply(targetRef.current);
    return () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(playRafRef.current);
      rafRef.current = 0;
      animationsRef.current.forEach((a) => a.cancel());
      animationsRef.current = [];
    };
  }, [containerRef, options.rebuildKey]);

  // Scroll mode: coalesce updates into one apply per frame.
  const progress = options.progress;
  const power = options.progressPower ?? 1;
  useEffect(() => {
    if (typeof progress !== "number" || !Number.isFinite(progress)) return;
    const p = Math.max(0, Math.min(1, progress)) ** power;
    targetRef.current = p;
    if (appliedRef.current < 0) {
      apply(p);
      return;
    }
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (targetRef.current !== appliedRef.current) apply(targetRef.current);
    });
  }, [progress, power]);

  // Play mode: drive progress through real time.
  const playing = options.playing;
  useEffect(() => {
    if (typeof optionsRef.current.progress === "number" || playing === undefined) return;
    cancelAnimationFrame(playRafRef.current);
    const total = Math.max(1, totalMsRef.current);
    const speed = playing ? 1 : (optionsRef.current.reverseSpeed ?? 1);
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const from = appliedRef.current < 0 ? 0 : appliedRef.current;
      const next = Math.max(0, Math.min(1, from + ((playing ? 1 : -1) * dt * speed) / total));
      targetRef.current = next;
      apply(next);
      if ((playing && next < 1) || (!playing && next > 0)) {
        playRafRef.current = requestAnimationFrame(tick);
      }
    };
    playRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(playRafRef.current);
  }, [playing]);
}
