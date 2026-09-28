"use client";

// The home page's 3D scene: the ClearSign mark drawn as point lattices, the way
// the reference draws its octagon, choreographed by stage progress. The home
// page mounts it once, behind the sections. It reads stage progress from the
// store itself and reports its own loading progress to the preloader store.
//
// three.js loads through a dynamic import inside the effect, so it never runs
// on the server. See docs/research/components/scene.spec.md.

import { useEffect, useRef, type CSSProperties } from "react";
import { preloader } from "@/lib/stage/store";

export type SceneProps = {
  className?: string;
};

const CONTAINER_STYLE: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1,
  background: "var(--ground)",
  pointerEvents: "none",
  overflow: "hidden",
};

function reportProgress(pct: number) {
  preloader.set((s) => ({ ...s, progress: Math.max(s.progress, pct) }));
}

function markReady() {
  preloader.set((s) => (s.ready ? s : { ...s, ready: true }));
}

function hasWebGL2(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export function Scene({ className }: SceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // No WebGL2: render nothing and let the preloader through at once.
    if (!hasWebGL2()) {
      markReady();
      return;
    }

    const controller = new AbortController();
    let engine: { dispose: () => void } | null = null;
    reportProgress(3);

    (async () => {
      try {
        const { createSceneEngine } = await import("./engine");
        if (controller.signal.aborted) return;
        reportProgress(30);
        const created = await createSceneEngine(container, {
          signal: controller.signal,
          onProgress: reportProgress,
          onReady: markReady,
        });
        if (controller.signal.aborted) {
          created?.dispose();
          return;
        }
        engine = created;
        if (!created) markReady();
      } catch (error) {
        // A scene that cannot start must never hold the gate shut.
        console.error("Scene failed to start:", error);
        if (!controller.signal.aborted) markReady();
      }
    })();

    return () => {
      controller.abort();
      engine?.dispose();
      engine = null;
    };
  }, []);

  return <div ref={containerRef} className={className} style={CONTAINER_STYLE} aria-hidden="true" />;
}
