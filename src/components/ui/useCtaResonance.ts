"use client";

import { useEffect, type RefObject } from "react";

// "CTA resonance": on a fine pointer, an interactive surface leans toward the
// pointer. It shifts a few pixels, tilts a few degrees and picks up a glow that
// sits under the pointer. Every value eases toward its target each frame and the
// loop stops once everything has settled.
//
// The hook only writes CSS custom properties and two data attributes; each
// component decides in its own stylesheet what they drive:
//   --cta-shift-x/y (px), --cta-tilt-x/y (deg), --cta-glow-alpha, --cta-pointer-x/y (%),
//   --cta-scale, [data-cta-active], [data-cta-pressed].

export type ResonanceOptions = {
  /** Largest shift in px at the element's edge. Default 10. */
  maxShift?: number;
  /** Largest tilt in degrees. Default 3.5. */
  maxRotate?: number;
  /** Largest glow alpha. Default 0.18. */
  maxGlow?: number;
  /** Enter/Space keydown counts as a press. Off for text fields. Default true. */
  pressKeys?: boolean;
  /** Tell the custom cursor to pulse on enter and focus. Default true. */
  pulse?: boolean;
};

const EASE_PER_FRAME = 0.16;
const PRESSED_SCALE = 0.982;
const FOCUS_GLOW_SHARE = 0.55;
// The custom cursor rings once around a point on this window event.
const CURSOR_PULSE_EVENT = "cursor:hover-anim";

type Channel = "shiftX" | "shiftY" | "tiltX" | "tiltY" | "glow" | "px" | "py";
const CHANNELS: Channel[] = ["shiftX", "shiftY", "tiltX", "tiltY", "glow", "px", "py"];
// How close counts as settled, per channel.
const SETTLE: Record<Channel, number> = {
  shiftX: 0.12,
  shiftY: 0.12,
  tiltX: 0.04,
  tiltY: 0.04,
  glow: 0.006,
  px: 0.35,
  py: 0.35,
};
const REST: Record<Channel, number> = { shiftX: 0, shiftY: 0, tiltX: 0, tiltY: 0, glow: 0, px: 50, py: 50 };

const isDisabled = (node: HTMLElement) =>
  node.matches(":disabled") || node.getAttribute("aria-disabled") === "true";

function pulseCursorAt(node: HTMLElement) {
  const r = node.getBoundingClientRect();
  window.dispatchEvent(
    new CustomEvent(CURSOR_PULSE_EVENT, { detail: { x: r.left + r.width / 2, y: r.top + r.height / 2 } }),
  );
}

export function useCtaResonance<T extends HTMLElement>(
  ref: RefObject<T | null>,
  { maxShift = 10, maxRotate = 3.5, maxGlow = 0.18, pressKeys = true, pulse = true }: ResonanceOptions = {},
) {
  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const fine = window.matchMedia("(pointer: fine)");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const now: Record<Channel, number> = { ...REST };
    const goal: Record<Channel, number> = { ...REST };
    let hovered = false;
    let focused = false;
    let frame = 0;

    const write = () => {
      const s = node.style;
      s.setProperty("--cta-shift-x", `${now.shiftX.toFixed(2)}px`);
      s.setProperty("--cta-shift-y", `${now.shiftY.toFixed(2)}px`);
      s.setProperty("--cta-tilt-x", `${now.tiltX.toFixed(2)}deg`);
      s.setProperty("--cta-tilt-y", `${now.tiltY.toFixed(2)}deg`);
      s.setProperty("--cta-glow-alpha", now.glow.toFixed(3));
      s.setProperty("--cta-pointer-x", `${now.px.toFixed(2)}%`);
      s.setProperty("--cta-pointer-y", `${now.py.toFixed(2)}%`);
    };

    const setScale = (value: number) => node.style.setProperty("--cta-scale", value.toFixed(3));

    const setActive = () => {
      if (hovered || focused) node.setAttribute("data-cta-active", "");
      else node.removeAttribute("data-cta-active");
    };

    const step = () => {
      frame = 0;
      let settled = true;
      for (const c of CHANNELS) {
        now[c] += (goal[c] - now[c]) * EASE_PER_FRAME;
        if (Math.abs(goal[c] - now[c]) >= SETTLE[c]) settled = false;
      }
      if (settled) Object.assign(now, goal);
      write();
      if (!settled) frame = requestAnimationFrame(step);
    };

    const run = () => {
      if (reduce.matches) {
        cancelAnimationFrame(frame);
        frame = 0;
        Object.assign(now, goal);
        write();
        return;
      }
      if (!frame) frame = requestAnimationFrame(step);
    };

    const focusGlow = () => (focused ? maxGlow * FOCUS_GLOW_SHARE : 0);

    const rest = () => {
      Object.assign(goal, REST);
      goal.glow = focusGlow();
      run();
    };

    const aim = (clientX: number, clientY: number) => {
      if (!fine.matches || reduce.matches || isDisabled(node)) {
        rest();
        return;
      }
      const r = node.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const nx = Math.max(-1, Math.min(1, ((clientX - r.left) / r.width) * 2 - 1));
      const ny = Math.max(-1, Math.min(1, ((clientY - r.top) / r.height) * 2 - 1));
      const strength = Math.min(Math.hypot(nx, ny) / Math.SQRT2, 1);
      goal.shiftX = nx * maxShift;
      goal.shiftY = ny * maxShift;
      goal.tiltX = -ny * maxRotate;
      goal.tiltY = nx * maxRotate;
      goal.glow = Math.max(strength * maxGlow, focusGlow());
      goal.px = (nx + 1) * 50;
      goal.py = (ny + 1) * 50;
      run();
    };

    const press = () => {
      if (isDisabled(node)) return;
      node.setAttribute("data-cta-pressed", "");
      setScale(PRESSED_SCALE);
    };
    const release = () => {
      node.removeAttribute("data-cta-pressed");
      setScale(1);
    };

    const onEnter = (e: PointerEvent) => {
      if (isDisabled(node)) return;
      hovered = true;
      setActive();
      aim(e.clientX, e.clientY);
      if (pulse && !reduce.matches) pulseCursorAt(node);
    };
    const onMove = (e: PointerEvent) => aim(e.clientX, e.clientY);
    const onLeave = () => {
      hovered = false;
      setActive();
      rest();
      setScale(1);
    };
    const onFocusIn = () => {
      if (isDisabled(node)) return;
      focused = true;
      setActive();
      goal.glow = Math.max(goal.glow, maxGlow * FOCUS_GLOW_SHARE);
      run();
      if (pulse && !reduce.matches) pulseCursorAt(node);
    };
    const onFocusOut = () => {
      focused = false;
      setActive();
      rest();
      setScale(1);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (!pressKeys || e.repeat) return;
      if (e.key === "Enter" || e.key === " ") press();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!pressKeys) return;
      if (e.key === "Enter" || e.key === " ") release();
    };

    node.addEventListener("pointerenter", onEnter);
    node.addEventListener("pointermove", onMove);
    node.addEventListener("pointerleave", onLeave);
    node.addEventListener("focusin", onFocusIn);
    node.addEventListener("focusout", onFocusOut);
    node.addEventListener("pointerdown", press);
    node.addEventListener("pointerup", release);
    node.addEventListener("pointercancel", release);
    node.addEventListener("keydown", onKeyDown);
    node.addEventListener("keyup", onKeyUp);

    return () => {
      cancelAnimationFrame(frame);
      node.removeEventListener("pointerenter", onEnter);
      node.removeEventListener("pointermove", onMove);
      node.removeEventListener("pointerleave", onLeave);
      node.removeEventListener("focusin", onFocusIn);
      node.removeEventListener("focusout", onFocusOut);
      node.removeEventListener("pointerdown", press);
      node.removeEventListener("pointerup", release);
      node.removeEventListener("pointercancel", release);
      node.removeEventListener("keydown", onKeyDown);
      node.removeEventListener("keyup", onKeyUp);
      node.removeAttribute("data-cta-active");
      node.removeAttribute("data-cta-pressed");
      Object.assign(now, REST);
      write();
      setScale(1);
    };
  }, [ref, maxShift, maxRotate, maxGlow, pressKeys, pulse]);
}
