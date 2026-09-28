"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion/easings";

// Dust hanging in the light. Each mote drifts slowly and twinkles, and is lit
// by how close it is to the aperture at the centre of the room, so the motes
// near the light glow and the ones in the corners barely show. Nearer motes
// move more with the pointer. Reduced motion draws one still frame.

type Mote = {
  x: number;
  y: number;
  /** Depth 0.25 (far) .. 1 (near). */
  z: number;
  r: number;
  vx: number;
  vy: number;
  phase: number;
  twinkle: number;
  tint: boolean;
};

const PARALLAX_PX = 26;

function readRgb(name: string, fallback: [number, number, number]): [number, number, number] {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (raw.startsWith("#") && (raw.length === 7 || raw.length === 4)) {
    const hex = raw.length === 4 ? raw.replace(/^#(.)(.)(.)$/, "#$1$1$2$2$3$3") : raw;
    const n = Number.parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const parts = raw.split(/[\s,]+/).map(Number);
  return parts.length >= 3 && parts.every(Number.isFinite) ? [parts[0], parts[1], parts[2]] : fallback;
}

function makeMotes(count: number): Mote[] {
  return Array.from({ length: count }, () => {
    const z = 0.25 + Math.random() * 0.75;
    return {
      x: Math.random(),
      y: Math.random(),
      z,
      r: (0.35 + Math.random() * 0.9) * (0.6 + z),
      vx: (Math.random() - 0.5) * 0.006,
      vy: -0.002 - Math.random() * 0.006,
      phase: Math.random() * Math.PI * 2,
      twinkle: 0.4 + Math.random() * 1.1,
      tint: Math.random() < 0.35,
    };
  });
}

export function Motes({ paused = false, className }: { paused?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const still = prefersReducedMotion();
    const ink = readRgb("--ink", [232, 236, 239]);
    const accent = readRgb("--accent-rgb", [74, 163, 201]);
    let width = 0;
    let height = 0;
    let motes: Mote[] = [];
    let frame = 0;
    let last = performance.now();
    let px = 0;
    let py = 0;
    let tx = 0;
    let ty = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(120, Math.max(36, (width * height) / 14000)));
      if (motes.length !== count) motes = makeMotes(count);
    };

    const draw = (time: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      const cx = width / 2;
      const cy = height / 2;
      const reach = Math.min(width, height) * 0.46;
      for (const m of motes) {
        const sx = m.x * width + px * PARALLAX_PX * m.z;
        const sy = m.y * height + py * PARALLAX_PX * m.z;
        const d = Math.hypot(sx - cx, sy - cy) / reach;
        const light = 0.1 + 0.9 * Math.exp(-d * d);
        const shimmer = 0.55 + 0.45 * Math.sin(time * 0.001 * m.twinkle + m.phase);
        const alpha = Math.min(1, 0.85 * light * shimmer * (0.35 + m.z * 0.65));
        if (alpha < 0.01) continue;
        const [r, g, b] = m.tint ? accent : ink;
        // A faint halo, then the grain itself.
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(alpha * 0.18).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, m.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(sx, sy, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = (time: number) => {
      const dt = Math.min(64, time - last) / 1000;
      last = time;
      if (!pausedRef.current) {
        px += (tx - px) * 0.05;
        py += (ty - py) * 0.05;
        for (const m of motes) {
          m.x += (m.vx + Math.sin(time * 0.0003 + m.phase) * 0.003) * dt * m.z;
          m.y += m.vy * dt * m.z;
          if (m.x < -0.02) m.x += 1.04;
          else if (m.x > 1.02) m.x -= 1.04;
          if (m.y < -0.02) {
            m.y += 1.04;
            m.x = Math.random();
          } else if (m.y > 1.02) m.y -= 1.04;
        }
        draw(time);
      }
      frame = requestAnimationFrame(step);
    };

    const start = () => {
      if (still || frame) return;
      last = performance.now();
      frame = requestAnimationFrame(step);
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      frame = 0;
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      tx = event.clientX / window.innerWidth - 0.5;
      ty = event.clientY / window.innerHeight - 0.5;
    };
    const onVisibility = () => (document.hidden ? stop() : start());
    const onResize = () => {
      resize();
      if (still) draw(0);
    };

    resize();
    draw(performance.now());
    start();
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
