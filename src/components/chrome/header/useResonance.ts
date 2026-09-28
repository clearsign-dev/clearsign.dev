"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { prefersReducedMotion } from "@/lib/motion/easings";

// The header tab leans toward the pointer: a small horizontal shift that eases
// after it, a slight press on pointer-down, and an "active" flag (hover or
// focus) that shows the fill. It writes CSS variables and a data attribute on
// the element directly, so pointer movement never re-renders React.
const MAX_SHIFT_PX = 10;
const SMOOTHING = 0.16;
const SETTLE_PX = 0.12;
const PRESSED_SCALE = 0.982;

type Motion = { target: number; current: number; frame: number; hovered: boolean; focused: boolean };

export function useResonance<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const motion = useRef<Motion>({ target: 0, current: 0, frame: 0, hovered: false, focused: false });

  useEffect(() => {
    const m = motion.current;
    return () => cancelAnimationFrame(m.frame);
  }, []);

  const canLean = () =>
    typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches && !prefersReducedMotion();

  const write = () => {
    ref.current?.style.setProperty("--shift-x", `${motion.current.current.toFixed(2)}px`);
  };

  const animate = () => {
    const m = motion.current;
    m.frame = 0;
    m.current += (m.target - m.current) * SMOOTHING;
    if (Math.abs(m.target - m.current) < SETTLE_PX) {
      m.current = m.target;
      write();
      return;
    }
    write();
    m.frame = requestAnimationFrame(animate);
  };

  const aim = (target: number) => {
    const m = motion.current;
    m.target = target;
    if (!canLean()) {
      m.current = target;
      write();
      return;
    }
    if (!m.frame) m.frame = requestAnimationFrame(animate);
  };

  const syncActive = () => {
    const el = ref.current;
    if (!el) return;
    const m = motion.current;
    if (m.hovered || m.focused) el.dataset.active = "true";
    else delete el.dataset.active;
  };

  const setPressed = (pressed: boolean) => {
    ref.current?.style.setProperty("--press", pressed ? String(PRESSED_SCALE) : "1");
  };

  const lean = (event: ReactPointerEvent<T>) => {
    const el = ref.current;
    if (!el || !canLean()) return aim(0);
    const rect = el.getBoundingClientRect();
    if (!rect.width) return;
    const nx = Math.max(-1, Math.min(1, ((event.clientX - rect.left) / rect.width - 0.5) * 2));
    aim(nx * MAX_SHIFT_PX);
  };

  const handlers = {
    onPointerEnter(event: ReactPointerEvent<T>) {
      motion.current.hovered = true;
      syncActive();
      lean(event);
    },
    onPointerMove: lean,
    onPointerLeave() {
      motion.current.hovered = false;
      syncActive();
      setPressed(false);
      aim(0);
    },
    onPointerDown() {
      setPressed(true);
    },
    onPointerUp() {
      setPressed(false);
    },
    onPointerCancel() {
      setPressed(false);
    },
    onFocus() {
      // Keyboard focus only: a mouse click that leaves focus behind should not
      // keep the tab filled after the pointer has gone.
      motion.current.focused = ref.current?.matches(":focus-visible") ?? false;
      syncActive();
    },
    onBlur() {
      motion.current.focused = false;
      syncActive();
      setPressed(false);
    },
  };

  return [ref, handlers] as const;
}
