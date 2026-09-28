"use client";

import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "@/lib/motion/easings";
import { watchLoadTarget } from "./loadTarget";
import { createPatternEngine } from "./pattern/engine";
import type { FromWorker, ToWorker } from "./pattern/protocol";
import { readPatternTokens } from "./pattern/tokens";

// Hosts the grid. It prefers a worker with an OffscreenCanvas and falls back
// to running the same engine on the main thread. A canvas whose control has
// been handed to a worker cannot be drawn on again, so every retry gets a
// fresh <canvas> (the key below).

const WORKER_TIMEOUT_MS = 1500;
const MAX_DPR = 2;
const MAX_RETRIES = 3;

type Mode = "worker" | "main";

type Driver = {
  resize: (width: number, height: number) => void;
  setTarget: (value: number, ready: boolean) => void;
  pointer: (x: number, y: number) => void;
  setActive: (active: boolean) => void;
  dispose: () => void;
};

type PatternCanvasProps = {
  /** The counter's whole-number value, each time it changes. */
  onProgress: (value: number) => void;
  className?: string;
};

export function PatternCanvas({ onProgress, className }: PatternCanvasProps) {
  const [surface, setSurface] = useState<{ mode: Mode; attempt: number }>({ mode: "worker", attempt: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onProgressRef = useRef(onProgress);
  const lastValueRef = useRef(0);

  useEffect(() => {
    onProgressRef.current = onProgress;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    let watchdog = 0;
    const reducedMotion = prefersReducedMotion();
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const tokens = readPatternTokens();
    const size = () => ({
      width: Math.max(1, Math.round(canvas.clientWidth)),
      height: Math.max(1, Math.round(canvas.clientHeight)),
    });
    const report = (value: number) => {
      lastValueRef.current = value;
      onProgressRef.current(value);
    };
    // Called from callbacks and timers only, never synchronously in this effect.
    const retry = (mode: Mode) => {
      if (disposed) return;
      setSurface((prev) => ({
        mode: prev.attempt + 1 >= MAX_RETRIES ? "main" : mode,
        attempt: prev.attempt + 1,
      }));
    };

    let driver: Driver | null = null;

    const canOffload =
      surface.mode === "worker" &&
      typeof Worker !== "undefined" &&
      typeof OffscreenCanvas !== "undefined" &&
      typeof canvas.transferControlToOffscreen === "function";

    if (canOffload) {
      let worker: Worker | null = null;
      try {
        worker = new Worker(new URL("./pattern/pattern.worker.ts", import.meta.url), { type: "module" });
      } catch {
        worker = null;
      }
      if (worker) {
        const live = worker;
        let alive = false;
        const post = (message: ToWorker, transfer: Transferable[] = []) => live.postMessage(message, transfer);
        const fail = () => {
          live.terminate();
          retry("main");
        };
        live.onmessage = (event: MessageEvent<FromWorker>) => {
          alive = true;
          const message = event.data;
          if (message.type === "progress") report(message.value);
          // A worker without a 2D context would count but show nothing.
          else if (!message.drawing) fail();
        };
        live.onerror = fail;
        live.onmessageerror = fail;
        try {
          const offscreen = canvas.transferControlToOffscreen();
          const { width, height } = size();
          post(
            {
              type: "init",
              canvas: offscreen,
              dpr,
              width,
              height,
              reducedMotion,
              tokens,
              startFrom: lastValueRef.current,
            },
            [offscreen],
          );
          watchdog = window.setTimeout(() => {
            if (!alive) fail();
          }, WORKER_TIMEOUT_MS);
          driver = {
            resize: (w, h) => post({ type: "resize", width: w, height: h }),
            setTarget: (value, ready) => post({ type: "target", value, ready }),
            pointer: (x, y) => post({ type: "pointer", x, y }),
            setActive: (active) => post({ type: "active", active }),
            dispose: () => {
              post({ type: "dispose" });
              live.terminate();
            },
          };
        } catch {
          // Usually a canvas already handed over (a remount in development).
          // Try again on a fresh canvas.
          live.terminate();
          watchdog = window.setTimeout(() => retry("worker"), 0);
          return () => {
            disposed = true;
            window.clearTimeout(watchdog);
          };
        }
      }
    }

    if (!driver) {
      // Main thread. Without a 2D context here too, the counter still runs.
      const engine = createPatternEngine({
        canvas,
        dpr,
        reducedMotion,
        tokens,
        startFrom: lastValueRef.current,
        onProgress: report,
      });
      const { width, height } = size();
      engine.resize(width, height);
      engine.start();
      driver = engine;
    }

    const active = driver;
    const stopWatching = watchLoadTarget((value, ready) => active.setTarget(value, ready));

    let measured = size();
    const resizeObserver = new ResizeObserver(() => {
      const next = size();
      if (next.width === measured.width && next.height === measured.height) return;
      measured = next;
      active.resize(next.width, next.height);
    });
    resizeObserver.observe(canvas);

    // The canvas fills the fixed shell, so viewport coordinates are canvas coordinates.
    const onPointerMove = (event: PointerEvent) => active.pointer(event.clientX, event.clientY);
    if (!reducedMotion) window.addEventListener("pointermove", onPointerMove, { passive: true });

    const onVisibility = () => active.setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      window.clearTimeout(watchdog);
      stopWatching();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      active.dispose();
    };
  }, [surface]);

  return (
    <canvas
      key={`${surface.mode}-${surface.attempt}`}
      ref={canvasRef}
      className={className}
      aria-hidden="true"
    />
  );
}
