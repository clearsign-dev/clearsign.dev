"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion/easings";
import { watchLoadTarget } from "./loadTarget";
import { createPatternEngine } from "./pattern/engine";
import { readPatternTokens } from "./pattern/tokens";

// Hosts the grid, drawn on the main thread. The reference draws it in a
// worker so the 3D scene's warm-up cannot stall the counter; Turbopack's
// static export copies a worker's TypeScript source instead of compiling it,
// so the worker could never have run. The scene's shader compile is short,
// and the counter picks up where it left off.

const MAX_DPR = 2;

type PatternCanvasProps = {
  /** The counter's whole-number value, each time it changes. */
  onProgress: (value: number) => void;
  className?: string;
};

export function PatternCanvas({ onProgress, className }: PatternCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onProgressRef = useRef(onProgress);

  useEffect(() => {
    onProgressRef.current = onProgress;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reducedMotion = prefersReducedMotion();
    const size = () => ({
      width: Math.max(1, Math.round(canvas.clientWidth)),
      height: Math.max(1, Math.round(canvas.clientHeight)),
    });

    // Without a 2D context the engine still runs the counter.
    const engine = createPatternEngine({
      canvas,
      dpr: Math.min(window.devicePixelRatio || 1, MAX_DPR),
      reducedMotion,
      tokens: readPatternTokens(),
      startFrom: 0,
      onProgress: (value) => onProgressRef.current(value),
    });
    let measured = size();
    engine.resize(measured.width, measured.height);
    engine.start();

    const stopWatching = watchLoadTarget((value, ready) => engine.setTarget(value, ready));

    const resizeObserver = new ResizeObserver(() => {
      const next = size();
      if (next.width === measured.width && next.height === measured.height) return;
      measured = next;
      engine.resize(next.width, next.height);
    });
    resizeObserver.observe(canvas);

    // The canvas fills the fixed shell, so viewport coordinates are canvas coordinates.
    const onPointerMove = (event: PointerEvent) => engine.pointer(event.clientX, event.clientY);
    if (!reducedMotion) window.addEventListener("pointermove", onPointerMove, { passive: true });

    const onVisibility = () => engine.setActive(!document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopWatching();
      resizeObserver.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      engine.dispose();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden="true" />;
}
