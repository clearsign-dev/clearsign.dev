"use client";

import { useEffect, useLayoutEffect, useRef, type RefObject } from "react";
import { scaleDuration } from "@/lib/motion/easings";
import { damp } from "@/lib/motion/progress";
import {
  applyCardReveal,
  clearCardReveal,
  collectCardTargets,
  viewportProgress,
  type CardItemTiming,
} from "./cardReveal";

// Drives the card column: its own reveal (fade, blur, slide), its travel
// (up on desktop, sideways on mobile, smoothed) and every card's viewport
// reveal, from one frame loop that writes straight to the DOM and sleeps once
// everything has settled.

type ColumnOptions = {
  /** 0..1, the column's fade-in. */
  reveal: number;
  /** 0..1, how far the column has travelled. */
  move: number;
  smoothingMs: number;
  /** Row layout (≤ 1024px) rather than the desktop column. */
  mobile: boolean;
  itemTiming: CardItemTiming;
};

// Per-card reveal smoothing, stretched on touch/narrow layouts.
const CARD_SMOOTHING_MS = 110;

export function useShipsColumn(columnRef: RefObject<HTMLElement | null>, options: ColumnOptions) {
  const optionsRef = useRef(options);
  const kickRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    optionsRef.current = options;
  });

  const { mobile } = options;

  useLayoutEffect(() => {
    const column = columnRef.current;
    if (!column) return;

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const touchQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    let reduced = reducedQuery.matches;
    const blur = !touchQuery.matches;
    const cardSmoothing = scaleDuration(CARD_SMOOTHING_MS, 1.65);

    const targets = collectCardTargets(column);
    const cardProgress: (number | undefined)[] = [];
    let travelX = 0;
    let travelY = 0;
    let move = optionsRef.current.move;
    let columnStyle = "";
    let frame = 0;
    let last = 0;

    const measure = () => {
      if (mobile) {
        // From the last card's far edge plus the row's end padding, rather than
        // scrollWidth, which not every engine pads at the end of a flex row.
        const lastSlot = targets[targets.length - 1]?.slot;
        const padEnd = parseFloat(getComputedStyle(column).paddingRight) || 0;
        const contentEnd = lastSlot ? lastSlot.offsetLeft + lastSlot.offsetWidth + padEnd : column.scrollWidth;
        travelX = Math.max(contentEnd - window.innerWidth, 0);
        travelY = 0;
      } else {
        travelY = Math.max(column.clientHeight - window.innerHeight, 0);
        travelX = 0;
      }
    };

    // Returns true while the column is still moving.
    const writeColumn = (snap: boolean, dt: number) => {
      const o = optionsRef.current;
      move = snap || reduced ? o.move : damp(move, o.move, o.smoothingMs, dt);
      const r = reduced ? 1 : o.reveal;
      const revealX = mobile ? 0 : (1 - r) * -32;
      const revealY = (1 - r) * 28;
      const x = revealX - travelX * move;
      const y = revealY - travelY * move;
      const transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(${(0.975 + r * 0.025).toFixed(4)})`;
      const opacity = r.toFixed(4);
      const filter = r >= 1 ? "" : `blur(${((1 - r) * 10).toFixed(2)}px)`;
      const next = `${transform}|${opacity}|${filter}`;
      const changed = next !== columnStyle;
      if (changed) {
        columnStyle = next;
        column.style.transform = transform;
        column.style.opacity = opacity;
        column.style.filter = filter;
      }
      return changed || move !== o.move;
    };

    // Returns true while any card is still catching up with its position.
    const updateCards = (snap: boolean, dt: number) => {
      if (reduced) return false;
      const o = optionsRef.current;
      // Read every rect before writing anything, so the frame never forces layout.
      const rects = targets.map((t) => t.slot.getBoundingClientRect());
      let busy = false;
      targets.forEach((t, i) => {
        const goal = viewportProgress(rects[i], mobile, t.last);
        const prev = cardProgress[i];
        const next = snap || prev === undefined ? goal : damp(prev, goal, cardSmoothing, dt);
        if (next !== goal) busy = true;
        if (next !== prev) {
          cardProgress[i] = next;
          applyCardReveal(t, next, o.itemTiming, mobile, blur);
        }
      });
      return busy;
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = last ? now - last : 16;
      last = now;
      const cardsBusy = updateCards(false, dt);
      const columnBusy = writeColumn(false, dt);
      if (cardsBusy || columnBusy) {
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

    // First paint: column in place, then cards measured from it.
    measure();
    writeColumn(true, 16);
    updateCards(true, 16);
    kick();

    const onResize = () => {
      measure();
      kick();
    };
    const onReducedChange = () => {
      reduced = reducedQuery.matches;
      if (reduced) {
        targets.forEach(clearCardReveal);
        cardProgress.length = 0;
      }
      kick();
    };

    const observer = new ResizeObserver(onResize);
    observer.observe(column);
    window.addEventListener("resize", onResize);
    reducedQuery.addEventListener("change", onReducedChange);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      reducedQuery.removeEventListener("change", onReducedChange);
      kickRef.current = () => {};
      targets.forEach(clearCardReveal);
      column.style.transform = "";
      column.style.opacity = "";
      column.style.filter = "";
    };
  }, [columnRef, mobile]);

  // New targets from scroll wake the loop.
  useEffect(() => {
    kickRef.current();
  }, [options.reveal, options.move]);
}
