"use client";

import { useEffect, useRef } from "react";

// A sheet of smoke: fractal value noise drawn once into a small canvas as a
// white alpha map. CSS stretches it across the room, and the browser's
// bilinear upscale is what makes it soft. Tone, masking and drift are the
// stylesheet's job.

const WIDTH = 256;
const HEIGHT = 144;

function lattice(seed: number) {
  // Integer hash to [0, 1).
  return (x: number, y: number) => {
    let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function valueNoise(seed: number) {
  const hash = lattice(seed);
  const fade = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = fade(x - x0);
    const fy = fade(y - y0);
    const a = hash(x0, y0);
    const b = hash(x0 + 1, y0);
    const c = hash(x0, y0 + 1);
    const d = hash(x0 + 1, y0 + 1);
    const top = a + (b - a) * fx;
    const bottom = c + (d - c) * fx;
    return top + (bottom - top) * fy;
  };
}

function paint(canvas: HTMLCanvasElement, seed: number, frequency: number) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const noise = valueNoise(seed);
  const image = ctx.createImageData(WIDTH, HEIGHT);
  const data = image.data;
  const aspect = WIDTH / HEIGHT;
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let sum = 0;
      let amp = 0.5;
      let fq = frequency;
      for (let o = 0; o < 5; o++) {
        sum += amp * noise((x / WIDTH) * fq * aspect, (y / HEIGHT) * fq);
        fq *= 2.03;
        amp *= 0.5;
      }
      // Keep the wisps, drop the flat middle, so it reads as smoke not fog.
      const t = Math.min(1, Math.max(0, (sum - 0.34) / 0.5));
      const alpha = t * t * (3 - 2 * t);
      const i = (y * WIDTH + x) * 4;
      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = Math.round(alpha * 255);
    }
  }
  ctx.putImageData(image, 0, 0);
}

type SmokeProps = {
  seed: number;
  /** Lattice cells across the sheet's height at the first octave. */
  frequency?: number;
  className?: string;
};

export function Smoke({ seed, frequency = 2.2, className }: SmokeProps) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (ref.current) paint(ref.current, seed, frequency);
  }, [seed, frequency]);

  return <canvas ref={ref} width={WIDTH} height={HEIGHT} className={className} aria-hidden="true" />;
}
