"use client";

import { useEffect, type RefObject } from "react";

// The eye glyph glances toward the pointer. The offset is measured from the
// eye's centre in units of its radius, ignores a small dead zone so the eye
// rests when the pointer is on it, and eases out so the edges feel deliberate.
// Written straight to CSS variables on the element: no React renders.

const DEAD_ZONE = 0.12;
const SMOOTHING = 0.24;
const SETTLE = 0.002;
// The glyph travels at most this fraction of the eye's radius.
const TRAVEL = 0.19;

function mapOffset(dx: number, dy: number) {
  const length = Math.hypot(dx, dy);
  if (length === 0) return { x: 0, y: 0 };
  const clamped = Math.min(length, 1);
  const normalised = Math.max((clamped - DEAD_ZONE) / (1 - DEAD_ZONE), 0);
  const eased = 1 - (1 - normalised) ** 3;
  return { x: (dx / length) * eased, y: (dy / length) * eased };
}

export function useEyeFollow(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!fine.matches || reduced.matches) return;

    const current = { x: 0, y: 0 };
    const target = { x: 0, y: 0 };
    let radius = 0;
    let frame = 0;

    const paint = () => {
      el.style.setProperty("--eye-x", `${(current.x * radius * TRAVEL).toFixed(2)}px`);
      el.style.setProperty("--eye-y", `${(current.y * radius * TRAVEL).toFixed(2)}px`);
    };

    const tick = () => {
      current.x += (target.x - current.x) * SMOOTHING;
      current.y += (target.y - current.y) * SMOOTHING;
      paint();
      if (Math.abs(target.x - current.x) > SETTLE || Math.abs(target.y - current.y) > SETTLE) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
      }
    };

    const start = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const rect = el.getBoundingClientRect();
      // Hidden (display: none on narrow layouts): nothing to aim.
      if (rect.width === 0) return;
      radius = rect.width / 2;
      const next = mapOffset(
        (event.clientX - (rect.left + radius)) / radius,
        (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2),
      );
      target.x = next.x;
      target.y = next.y;
      start();
    };

    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      start();
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [ref]);
}
