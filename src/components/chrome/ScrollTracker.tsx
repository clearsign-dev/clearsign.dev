"use client";

import { clsx } from "clsx";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { EASE, prefersReducedMotion, scaleDuration } from "@/lib/motion/easings";
import { SECTIONS } from "@/lib/stage/sections";
import { canScroll, scrollProgress, useStore } from "@/lib/stage/store";
import styles from "./ScrollTracker.module.css";

// Bottom-left pagination: "NN ◆ Label". The number and the label each sit on
// a reel holding every entry, and the reels roll to the active one. Before the
// first section it invites the visitor to scroll; on contact (no label) it
// shows nothing.

// The hero is not a tracker entry: entry k is section k + 1, numbered 01..07.
const ENTRIES = SECTIONS.slice(1).map((section) => ({
  number: String(section.index).padStart(2, "0"),
  label: section.label,
  start: section.start,
}));

const FIRST_START = ENTRIES[0]?.start ?? 0;
const SCROLL_HINT = SECTIONS[0]?.label ?? "";

const MOTION = {
  number: { duration: 0.58, easing: "cubic-bezier(0.65, 0, 0.35, 1)" },
  label: { duration: 0.72, easing: "cubic-bezier(0.65, 0, 0.35, 1)" },
  width: { duration: 0.34, easing: EASE.power2Out },
} as const;

/** -1 before the first entry, otherwise the entry whose section has begun. */
function entryIndexAt(progress: number): number {
  if (progress < FIRST_START - 0.0001) return -1;
  for (let i = ENTRIES.length - 1; i >= 0; i--) {
    if (progress >= ENTRIES[i].start) return i;
  }
  return 0;
}

export function ScrollTracker() {
  const index = useStore(scrollProgress, entryIndexAt);
  const unlocked = useStore(canScroll);
  const entry = index >= 0 ? ENTRIES[index] : null;

  const showHint = !entry && unlocked && SCROLL_HINT !== "";
  const showBox = entry !== null && entry.label !== "";

  return (
    <div className={styles.tracker}>
      {showHint ? (
        <span className={styles.hint}>
          <span className={styles.hintText}>{SCROLL_HINT}</span>
        </span>
      ) : null}
      {showBox ? <TrackerBox index={index} /> : null}
      <span className={styles.srOnly} aria-live="polite">
        {showBox && entry ? `${entry.number} ${entry.label}` : ""}
      </span>
    </div>
  );
}

type Slide = { animation: Animation | null; target: string };

// Moves one CSS property to `to`, starting from whatever is on screen now
// (including a slide still in flight), so a change mid-roll never snaps.
function slide(
  element: HTMLElement,
  property: "transform" | "width",
  to: string,
  slot: Slide,
  timing: { duration: number; easing: string } | null,
) {
  if (timing && slot.target === to) return;
  const from = getComputedStyle(element)[property];
  slot.animation?.cancel();
  slot.animation = null;
  slot.target = to;
  element.style[property] = to;
  if (!timing || from === "auto") return;
  slot.animation = element.animate([{ [property]: from }, { [property]: to }], {
    duration: scaleDuration(timing.duration) * 1000,
    easing: timing.easing,
  });
}

type Reels = {
  numbers: HTMLElement | null;
  labels: HTMLElement | null;
  viewport: HTMLElement | null;
  slides: Record<"number" | "label" | "width", Slide>;
};

// Rolls both reels to entry `i` and fits the label window to that label.
function roll({ numbers, labels, viewport, slides }: Reels, i: number, animate: boolean) {
  if (!numbers || !labels || !viewport) return;

  const itemHeight = (labels.firstElementChild as HTMLElement | null)?.getBoundingClientRect().height ?? 0;
  const offset = `translate3d(0, ${-itemHeight * i}px, 0)`;
  const active = labels.children[i] as HTMLElement | undefined;
  const width = active ? Math.ceil(active.scrollWidth) : 0;

  if (width > 0) slide(viewport, "width", `${width}px`, slides.width, animate ? MOTION.width : null);
  slide(numbers, "transform", offset, slides.number, animate ? MOTION.number : null);
  slide(labels, "transform", offset, slides.label, animate ? MOTION.label : null);
}

function TrackerBox({ index }: { index: number }) {
  const numberTrack = useRef<HTMLSpanElement>(null);
  const labelTrack = useRef<HTMLSpanElement>(null);
  const labelViewport = useRef<HTMLSpanElement>(null);
  const indexRef = useRef(index);
  const synced = useRef(false);
  const slides = useRef<Reels["slides"]>({
    number: { animation: null, target: "" },
    label: { animation: null, target: "" },
    width: { animation: null, target: "" },
  });

  // Only ever called from effects, never during render.
  const seat = useCallback(
    (i: number, animate: boolean) =>
      roll(
        {
          numbers: numberTrack.current,
          labels: labelTrack.current,
          viewport: labelViewport.current,
          slides: slides.current,
        },
        i,
        animate,
      ),
    [],
  );

  // Before paint: the first appearance lands in place, later changes roll.
  useLayoutEffect(() => {
    indexRef.current = index;
    seat(index, synced.current && !prefersReducedMotion());
    synced.current = true;
  }, [index, seat]);

  // Sizes depend on the font; re-seat without motion when they change.
  useEffect(() => {
    const reseat = () => seat(indexRef.current, false);
    window.addEventListener("resize", reseat);
    let alive = true;
    document.fonts?.ready.then(() => {
      if (alive) reseat();
    });
    const current = slides.current;
    return () => {
      alive = false;
      window.removeEventListener("resize", reseat);
      current.number.animation?.cancel();
      current.label.animation?.cancel();
      current.width.animation?.cancel();
    };
  }, [seat]);

  return (
    <div className={styles.box}>
      <span className={clsx(styles.reel, styles.numberReel)} aria-hidden="true">
        <span ref={numberTrack} className={styles.reelTrack}>
          {ENTRIES.map((e) => (
            <span key={e.number} className={styles.reelItem}>
              {e.number}
            </span>
          ))}
        </span>
      </span>
      <span className={styles.diamond} aria-hidden="true" />
      <span ref={labelViewport} className={clsx(styles.reel, styles.labelReel)} aria-hidden="true">
        <span ref={labelTrack} className={styles.reelTrack}>
          {ENTRIES.map((e) => (
            <span key={e.number} className={styles.reelItem}>
              {e.label}
            </span>
          ))}
        </span>
      </span>
    </div>
  );
}
