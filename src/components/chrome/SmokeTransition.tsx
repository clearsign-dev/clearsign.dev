"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion/easings";
import { createStore } from "@/lib/stage/store";
import { createSmokeField, type SmokeStage } from "./header/smokeField";
import styles from "./SmokeTransition.module.css";

// The full-screen transition the menu, the logo and the header CTA use to
// jump between sections: fog rolls over the screen (520ms, ease-out quint),
// the jump starts underneath, and the fog rolls on and off (640ms, ease-in-out
// cubic). Reduced motion gets a flat 140ms / 160ms fade. Timings are the
// reference's; the look is drawn procedurally (see header/smokeField.ts).

const COVER_MS = 520;
const REVEAL_MS = 640;
const REDUCED_COVER_MS = 140;
const REDUCED_REVEAL_MS = 160;

const easeOutQuint = (t: number) => 1 - (1 - t) ** 5;
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

export type SmokeTransitionState = { active: boolean; stage: "idle" | SmokeStage };

const IDLE: SmokeTransitionState = { active: false, stage: "idle" };

/** For anything that should stand aside while the screen is covered. */
export const smokeTransitionState = createStore<SmokeTransitionState>(IDLE);

type SmokeRenderer = {
  begin: (reduced: boolean) => void;
  draw: (progress: number, stage: SmokeStage, seconds: number) => void;
  end: () => void;
};

let renderer: SmokeRenderer | null = null;
let running = false;

export function isSmokeTransitionRunning() {
  return running;
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

function tween(
  durationMs: number,
  ease: (t: number) => number,
  from: number,
  to: number,
  onFrame: (value: number, now: number) => void,
) {
  return new Promise<void>((resolve) => {
    const startedAt = performance.now();
    const tick = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - startedAt) / durationMs));
      onFrame(from + (to - from) * ease(t), now);
      if (t >= 1) resolve();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Cover the screen, call `onCovered`, then uncover it. A call made while one
 * is already running is dropped (its callback never runs), as on the
 * reference. Without a mounted layer the callback runs at once.
 */
export async function runSmokeTransition(onCovered: () => void): Promise<void> {
  const layer = typeof window === "undefined" ? null : renderer;
  if (!layer) {
    onCovered();
    return;
  }
  if (running) return;
  running = true;

  const reduced = prefersReducedMotion();
  const coverMs = reduced ? REDUCED_COVER_MS : COVER_MS;
  const revealMs = reduced ? REDUCED_REVEAL_MS : REVEAL_MS;
  const startedAt = performance.now();
  const draw = (stage: SmokeStage) => (value: number, now: number) =>
    layer.draw(value, stage, (now - startedAt) / 1000);
  let failure: unknown = null;

  try {
    layer.begin(reduced);
    smokeTransitionState.set({ active: true, stage: "covering" });
    await nextFrame();
    await tween(coverMs, easeOutQuint, 0, 1, draw("covering"));

    try {
      onCovered();
    } catch (error) {
      failure = error;
    }

    smokeTransitionState.set({ active: true, stage: "revealing" });
    await nextFrame();
    await tween(revealMs, easeInOutCubic, 1, 0, draw("revealing"));
  } finally {
    layer.end();
    smokeTransitionState.set(IDLE);
    running = false;
  }

  if (failure) throw failure;
}

/** The overlay itself. Mount once, anywhere; it positions itself. */
export function SmokeTransitionLayer() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    const veil = veilRef.current;
    if (!root || !canvas || !veil) return;
    const field = createSmokeField(canvas);
    let flat = true;

    const layer: SmokeRenderer = {
      begin(reduced) {
        flat = reduced || !field;
        if (!flat) field?.prepare();
        root.dataset.active = "true";
        root.dataset.mode = flat ? "fade" : "smoke";
      },
      draw(progress, stage, seconds) {
        if (flat) veil.style.opacity = progress.toFixed(3);
        else field?.render(progress, stage, seconds);
      },
      end() {
        field?.clear();
        veil.style.opacity = "0";
        delete root.dataset.active;
      },
    };

    renderer = layer;
    return () => {
      if (renderer === layer) renderer = null;
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.layer} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.canvas} />
      <div ref={veilRef} className={styles.veil} />
    </div>
  );
}
