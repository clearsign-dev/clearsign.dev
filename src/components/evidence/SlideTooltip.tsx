"use client";

import { useCallback, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from "react";
import styles from "./SlideTooltip.module.css";

// The hovered card's title in an accent bubble that follows the cursor.
// Position is written straight to the element so a pointer move never
// re-renders; only a change of text does.

export type SlideTooltipHandle = {
  show: (text: string, x: number, y: number) => void;
  move: (x: number, y: number) => void;
  hide: () => void;
};

const EDGE_MARGIN = 12;
const GAP = 22;
const TAIL_INSET = 14;

export function SlideTooltip({ ref }: { ref?: Ref<SlideTooltipHandle> }) {
  const [text, setText] = useState<string | null>(null);
  const elRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<string | null>(null);
  const anchor = useRef({ x: 0, y: 0 });

  const place = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const { x, y } = anchor.current;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const half = el.offsetWidth / 2;
    const minX = half + EDGE_MARGIN;
    const maxX = vw - half - EDGE_MARGIN;
    const left = maxX < minX ? vw / 2 : Math.max(minX, Math.min(maxX, x));
    // When nudged away from the edge, the tail still points at the cursor.
    const tailLimit = Math.max(0, half - TAIL_INSET);
    const tail = Math.max(-tailLimit, Math.min(tailLimit, x - left));
    const height = el.offsetHeight;
    const fitsAbove = y - GAP - height >= EDGE_MARGIN;
    const fitsBelow = y + GAP + height <= vh - EDGE_MARGIN;
    el.style.left = `${left.toFixed(1)}px`;
    el.style.top = `${y.toFixed(1)}px`;
    el.style.setProperty("--tail-x", `${tail.toFixed(1)}px`);
    if (!fitsAbove && fitsBelow) el.dataset.flipped = "true";
    else delete el.dataset.flipped;
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      show(next, x, y) {
        anchor.current = { x, y };
        if (textRef.current !== next) {
          textRef.current = next;
          setText(next);
        } else {
          place();
        }
      },
      move(x, y) {
        anchor.current = { x, y };
        place();
      },
      hide() {
        if (textRef.current === null) return;
        textRef.current = null;
        setText(null);
      },
    }),
    [place],
  );

  // New text changes the bubble's size: measure and place before paint.
  useLayoutEffect(() => {
    if (text) place();
  }, [text, place]);

  if (!text) return null;

  return (
    <div ref={elRef} className={styles.tooltip} aria-hidden="true">
      <p className={styles.text}>{text}</p>
      <span className={styles.tail} />
    </div>
  );
}
