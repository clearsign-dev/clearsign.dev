"use client";

import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from "react";
import { playSfx } from "@/lib/audio/sfx";
import type { SHIPS } from "@/lib/content";
import { ShipIcon } from "./ShipIcon";
import styles from "./ShipCard.module.css";

// One way ClearSign ships: a big index, the name with its status tag over a
// hairline, a line icon in the middle, and a short note at the bottom. The card
// leans toward the pointer and gives slightly when pressed.

export type ShipCardData = (typeof SHIPS.cards)[number];

type ShipCardProps = {
  card: ShipCardData;
  total: number;
};

const MAX_ROTATE_DEG = 6.4;
const MAX_SHIFT_PX = 11;
const MAX_ICON_SHIFT_PX = 14;
const TILT_SMOOTHING = 0.12;
const MAX_POINTER_DISTANCE = Math.hypot(0.5, 0.5);
const RELEASE_PEAK_MS = 130;
const RELEASE_END_MS = 340;

function useCardTilt() {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef({
    target: { x: 0, y: 0 },
    current: { x: 0, y: 0 },
    tracking: false,
    hovering: false,
    pressing: false,
    frame: 0,
    timers: [] as number[],
  });

  const enabled = () =>
    typeof window !== "undefined" && !window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const paint = (x: number, y: number) => {
    const el = ref.current;
    if (!el) return;
    const intensity = Math.min(Math.hypot(x, y) / MAX_POINTER_DISTANCE, 1);
    const set = (name: string, value: string) => el.style.setProperty(name, value);
    set("--card-rotate-x", `${(-y * MAX_ROTATE_DEG).toFixed(1)}deg`);
    set("--card-rotate-y", `${(x * MAX_ROTATE_DEG).toFixed(1)}deg`);
    set("--card-shift-x", `${Math.round(x * MAX_SHIFT_PX)}px`);
    set("--card-shift-y", `${Math.round(y * MAX_SHIFT_PX)}px`);
    set("--icon-shift-x", `${Math.round(x * MAX_ICON_SHIFT_PX)}px`);
    set("--icon-shift-y", `${Math.round(y * MAX_ICON_SHIFT_PX)}px`);
    set("--icon-scale", (1.012 + intensity * 0.028).toFixed(3));
    set("--icon-z", `${Math.round(24 + intensity * 9)}px`);
    set("--card-pointer-x", `${Math.round((x + 0.5) * 100)}%`);
    set("--card-pointer-y", `${Math.round((y + 0.5) * 100)}%`);
    set("--card-glow", (0.1 + intensity * 0.19).toFixed(2));
  };

  const tick = () => {
    const s = state.current;
    s.frame = 0;
    if (!s.tracking) return;
    s.current.x += (s.target.x - s.current.x) * TILT_SMOOTHING;
    s.current.y += (s.target.y - s.current.y) * TILT_SMOOTHING;
    const settled =
      Math.abs(s.target.x - s.current.x) < 0.002 && Math.abs(s.target.y - s.current.y) < 0.002;
    if (settled) {
      s.current = { ...s.target };
      paint(s.current.x, s.current.y);
      if (!s.hovering && s.target.x === 0 && s.target.y === 0) {
        s.tracking = false;
        ref.current?.style.setProperty("--card-glow", "0");
      }
      return;
    }
    paint(s.current.x, s.current.y);
    s.frame = requestAnimationFrame(tick);
  };

  const schedule = () => {
    if (!state.current.frame) state.current.frame = requestAnimationFrame(tick);
  };

  const clearTimers = () => {
    state.current.timers.forEach((t) => window.clearTimeout(t));
    state.current.timers = [];
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || event.pointerType === "touch" || !enabled()) return;
    const s = state.current;
    const rect = el.getBoundingClientRect();
    s.hovering = true;
    el.dataset.hovering = "true";
    s.target = {
      x: (event.clientX - rect.left) / rect.width - 0.5,
      y: (event.clientY - rect.top) / rect.height - 0.5,
    };
    if (!s.tracking) {
      s.tracking = true;
      s.current = { x: s.target.x * 0.35, y: s.target.y * 0.35 };
    }
    schedule();
  };

  const onPointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    playSfx("hover");
    onPointerMove(event);
  };

  const settle = () => {
    const s = state.current;
    s.hovering = false;
    if (ref.current) delete ref.current.dataset.hovering;
    s.target = { x: 0, y: 0 };
    if (s.tracking) schedule();
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || !enabled()) return;
    clearTimers();
    state.current.pressing = true;
    delete el.dataset.releasing;
    el.dataset.pressing = "true";
    el.style.setProperty("--press-scale", "0.975");
    try {
      el.setPointerCapture(event.pointerId);
    } catch {
      // The pointer may already be gone; the press still resolves on release.
    }
  };

  const release = (event?: ReactPointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    const s = state.current;
    if (!el || !s.pressing) return;
    if (event && el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
    clearTimers();
    s.pressing = false;
    delete el.dataset.pressing;
    el.dataset.releasing = "true";
    el.style.setProperty("--press-scale", "1.018");
    s.timers.push(
      window.setTimeout(() => el.style.setProperty("--press-scale", "1"), RELEASE_PEAK_MS),
      window.setTimeout(() => delete el.dataset.releasing, RELEASE_END_MS),
    );
  };

  useEffect(() => {
    const s = state.current;
    return () => {
      cancelAnimationFrame(s.frame);
      s.timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  return {
    ref,
    handlers: {
      onPointerEnter,
      onPointerMove,
      onPointerLeave: settle,
      onPointerDown,
      onPointerUp: release,
      onPointerCancel: release,
    },
  };
}

export function ShipCard({ card, total }: ShipCardProps) {
  const { ref, handlers } = useCardTilt();
  const titleId = `ship-card-${card.id}`;

  return (
    <article className={styles.slot} data-ship-card aria-labelledby={titleId}>
      <div className={styles.surface} data-reveal="surface">
        <div ref={ref} className={styles.card} {...handlers}>
          <div className={styles.number} data-reveal="number" aria-hidden="true">
            <span className={styles.id}>{card.id}</span>
            <span className={styles.total}>/ {total}</span>
          </div>
          <div className={styles.titleRow}>
            <h3 id={titleId} className={styles.name} data-reveal="description">
              {card.name}
            </h3>
            <span className={styles.tag} data-reveal="type">
              {card.status}
            </span>
          </div>
          <div className={styles.icon}>
            <div className={styles.iconReveal} data-reveal="icon">
              <div className={styles.iconInner}>
                <ShipIcon name={card.icon} className={styles.iconSvg} />
              </div>
            </div>
          </div>
          <p className={styles.detail} data-reveal="description">
            {card.detail}
          </p>
        </div>
      </div>
    </article>
  );
}
