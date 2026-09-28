"use client";

import { useEffect, type RefObject } from "react";

// Eases a few CSS variables on `ref` toward the pointer, so the glass fill of
// the 4s and the scene's parallax layers lean with it:
//   --drift-x / --drift-y   px, ±range/2 at the viewport edges
//   --nx / --ny             the same as a unitless -0.5..0.5
//   --focus-x / --focus-y   where the 4s' highlight sits, in %
//   --glow-alpha            the highlight's strength
// Touch input is ignored; with no pointer the page rests at the centre.

const RANGE = 34;
const SMOOTHING = 0.11;
const SETTLE = 0.08;

export function usePointerDrift(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    let cx = 0;
    let cy = 0;
    let tx = 0;
    let ty = 0;
    let active = false;

    const paint = () => {
      const strength = Math.min(Math.hypot(cx, cy) / RANGE, 1);
      el.style.setProperty("--drift-x", `${cx.toFixed(2)}px`);
      el.style.setProperty("--drift-y", `${cy.toFixed(2)}px`);
      el.style.setProperty("--nx", (cx / RANGE).toFixed(4));
      el.style.setProperty("--ny", (cy / RANGE).toFixed(4));
      el.style.setProperty("--focus-x", `${(50 + (cx / RANGE) * 18).toFixed(2)}%`);
      el.style.setProperty("--focus-y", `${(50 + (cy / RANGE) * 24).toFixed(2)}%`);
      el.style.setProperty("--glow-alpha", (active ? 0.22 + strength * 0.16 : 0.18).toFixed(3));
    };

    const tick = () => {
      const dx = tx - cx;
      const dy = ty - cy;
      cx += dx * SMOOTHING;
      cy += dy * SMOOTHING;
      if (Math.abs(dx) < SETTLE && Math.abs(dy) < SETTLE) {
        cx = tx;
        cy = ty;
        paint();
        frame = 0;
        return;
      }
      paint();
      frame = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      tx = (event.clientX / window.innerWidth - 0.5) * RANGE;
      ty = (event.clientY / window.innerHeight - 0.5) * RANGE;
      if (!active) {
        active = true;
        cx = tx * 0.2;
        cy = ty * 0.2;
      }
      wake();
    };

    const onLeave = () => {
      active = false;
      tx = 0;
      ty = 0;
      wake();
    };

    paint();
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [ref]);
}
