"use client";

import { useEffect, useRef } from "react";
import { prefersReducedMotion } from "@/lib/motion/easings";

// The dotted glyph inside the gate's orb: a small sound pulse drawn in dots.
// At rest it is a still, centred pulse; while `live` it turns into a moving
// waveform, a preview of the sound the visitor is about to turn on.

const COLS = 9;
const ROWS = 5;
const DOT_R = 1.35;
const PITCH = 5.2;
const WIDTH = 44;
const HEIGHT = 24;
const MIDDLE_ROW = (ROWS - 1) / 2;
const X0 = (WIDTH - (COLS - 1) * PITCH) / 2;
const Y0 = HEIGHT / 2 - MIDDLE_ROW * PITCH;
// How many dots above and below the centre line each column lights at rest.
const REST = [0, 0, 1, 1, 2, 1, 1, 0, 0];

const DOTS = Array.from({ length: COLS * ROWS }, (_, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return { col, row, x: X0 + col * PITCH, y: Y0 + row * PITCH };
});

const litAt = (height: number, row: number) => Math.abs(row - MIDDLE_ROW) <= height;

function liveHeights(t: number, blend: number): number[] {
  const heights: number[] = [];
  for (let col = 0; col < COLS; col++) {
    const x = col / (COLS - 1);
    const envelope = Math.exp(-(((x - 0.5) / 0.32) ** 2));
    const swell = 0.5 + 0.5 * Math.sin(2 * Math.PI * (x * 1.4 - t * 0.9));
    const ripple = 0.5 + 0.5 * Math.sin(2 * Math.PI * (x * 2.7 + t * 0.55) + 1.3);
    const live = envelope * (0.35 + 0.65 * (0.7 * swell + 0.3 * ripple)) * (MIDDLE_ROW + 0.4);
    heights.push(Math.round(REST[col] * (1 - blend) + live * blend));
  }
  return heights;
}

export function DotGlyph({ live, className }: { live: boolean; className?: string }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !live || prefersReducedMotion()) return;
    const circles = Array.from(svg.querySelectorAll<SVGCircleElement>("circle"));
    const paint = (heights: number[]) => {
      circles.forEach((circle, i) => {
        const { col, row } = DOTS[i];
        circle.style.opacity = litAt(heights[col], row) ? "1" : "0";
      });
    };
    let frame = 0;
    let previous = performance.now();
    let clock = 0;
    let blend = 0;
    const tick = (now: number) => {
      const dt = Math.min(64, now - previous);
      previous = now;
      clock += dt / 1000;
      blend += (1 - blend) * (1 - Math.exp(-dt / 230));
      paint(liveHeights(clock, blend));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      paint(REST);
    };
  }, [live]);

  return (
    <svg
      ref={svgRef}
      className={className}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      fill="currentColor"
      aria-hidden="true"
      data-live={live || undefined}
    >
      {DOTS.map((dot, i) => (
        <circle
          key={i}
          cx={dot.x}
          cy={dot.y}
          r={DOT_R}
          style={{ opacity: litAt(REST[dot.col], dot.row) ? 1 : 0 }}
        />
      ))}
    </svg>
  );
}
