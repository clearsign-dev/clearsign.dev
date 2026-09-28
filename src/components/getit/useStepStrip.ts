"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { damp } from "@/lib/motion/progress";

// Moves the step cards. One smoothed "active" value (0 .. steps − 1) drives
// both layouts:
//   desktop — a strip that slides left one card per step; each card shrinks
//             and tilts as the strip passes it, and the next card covers it;
//   mobile  — cards stacked in one place, crossfading into each other.
// Styles are written straight to the slots; the loop sleeps once settled.

const DESKTOP_MIN_SCALE = 0.45;
const DESKTOP_MAX_ROTATION_DEG = -8;
const MOBILE_CROSSFADE_FALLOFF = 1.8;
const MOBILE_SNAP_FALLOFF = 2.5;
const MOBILE_SNAP_SCALE = 0.018;
const MOBILE_PRESS_SCALE = 0.015;

type StripOptions = {
  /** Where the active value is heading, 0 .. steps − 1. */
  target: number;
  smoothingMs: number;
  mobile: boolean;
};

export function useStepStrip(sliderRef: RefObject<HTMLElement | null>, options: StripOptions) {
  const optionsRef = useRef(options);
  const pressedRef = useRef(-1);
  const kickRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  const { mobile } = options;

  useLayoutEffect(() => {
    const slider = sliderRef.current;
    if (!slider) return;

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let reduced = reducedQuery.matches;
    let slots: HTMLElement[] = [];
    let spacing = 0;
    let active = optionsRef.current.target;
    let frame = 0;
    let last = 0;

    const measure = () => {
      slots = Array.from(slider.querySelectorAll<HTMLElement>("[data-step-slot]"));
      spacing = 0;
      if (mobile || !slots[0]) return;
      const gap = parseFloat(getComputedStyle(slots[0]).marginRight) || 0;
      spacing = slots[0].offsetWidth + gap;
    };

    const setVars = (el: HTMLElement, x: number, scale: number, rotate: number, opacity: number) => {
      el.style.setProperty("--card-x", `${x.toFixed(2)}px`);
      el.style.setProperty("--card-scale", scale.toFixed(4));
      el.style.setProperty("--card-rotate", `${rotate.toFixed(3)}deg`);
      el.style.setProperty("--card-opacity", opacity.toFixed(4));
    };

    const apply = (value: number) => {
      const count = slots.length;
      if (!mobile) {
        const drag = value * spacing;
        slider.style.transform = spacing > 0 ? `translate3d(${(-drag).toFixed(2)}px, 0, 0)` : "";
        slots.forEach((el, i) => {
          const local = spacing > 0 ? Math.max(0, drag - i * spacing) : 0;
          const t = spacing > 0 ? Math.min(local / spacing, 1) : 0;
          // Pinned where it stood while it shrinks; later cards slide over it.
          setVars(el, local, 1 - (1 - DESKTOP_MIN_SCALE) * t, DESKTOP_MAX_ROTATION_DEG * t, 1);
          el.style.zIndex = String(i + 1);
        });
        return;
      }
      slider.style.transform = "";
      const pressed = pressedRef.current;
      slots.forEach((el, i) => {
        const distance = Math.abs(i - value);
        const isPressed = i === pressed;
        const opacity = isPressed ? 1 : Math.max(0, 1 - distance * MOBILE_CROSSFADE_FALLOFF);
        const bump = Math.max(0, 1 - distance * MOBILE_SNAP_FALLOFF);
        let scale = reduced ? 1 : 1 + MOBILE_SNAP_SCALE * bump * bump;
        if (isPressed && !reduced) scale += MOBILE_PRESS_SCALE;
        setVars(el, 0, scale, 0, opacity);
        el.style.zIndex = String(distance < 0.5 ? count + 10 - i : count - i);
      });
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = last ? now - last : 16;
      last = now;
      const { target, smoothingMs } = optionsRef.current;
      active = reduced ? target : damp(active, target, smoothingMs, dt);
      apply(active);
      if (active !== target) {
        frame = requestAnimationFrame(tick);
      } else {
        last = 0;
      }
    };

    const kick = () => {
      if (frame) return;
      last = 0;
      frame = requestAnimationFrame(tick);
    };
    kickRef.current = kick;

    measure();
    apply(active);

    const onResize = () => {
      measure();
      apply(active);
      kick();
    };
    const onReducedChange = () => {
      reduced = reducedQuery.matches;
      kick();
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(slider);
    window.addEventListener("resize", onResize);
    reducedQuery.addEventListener("change", onReducedChange);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      reducedQuery.removeEventListener("change", onReducedChange);
      kickRef.current = () => {};
      slider.style.transform = "";
      slots.forEach((el) => {
        ["--card-x", "--card-scale", "--card-rotate", "--card-opacity"].forEach((p) => el.style.removeProperty(p));
        el.style.zIndex = "";
      });
    };
  }, [sliderRef, mobile]);

  useEffect(() => {
    kickRef.current();
  }, [options.target]);

  const press = useCallback((index: number) => {
    pressedRef.current = index;
    kickRef.current();
  }, []);

  const release = useCallback(() => {
    if (pressedRef.current === -1) return;
    pressedRef.current = -1;
    kickRef.current();
  }, []);

  return { press, release };
}

/** Index the strip is settling on, for focus and pointer handling. */
export function settledIndex(target: number, count: number): number {
  return Math.min(Math.max(count - 1, 0), Math.max(0, Math.round(target)));
}
