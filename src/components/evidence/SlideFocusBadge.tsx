"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { EASE } from "@/lib/motion/easings";
import type { EvidenceSlide } from "./SlideCard";
import styles from "./SlideFocusBadge.module.css";

// Narrow layouts only: an accent pill under the description that names the
// centred card. The label rolls like a reel: the clip box resizes to the new
// label while the track slides to it.

type SlideFocusBadgeProps = {
  slides: readonly EvidenceSlide[];
  /** Focused slide (already debounced by the train). */
  index: number;
  /** The train is on screen. */
  visible: boolean;
  /** The section's own content reveal, so the pill fades in with the copy. */
  reveal: number;
};

const SIZE_TWEEN_S = 0.34;
const TRACK_TWEEN_S = 0.72;
// power2.inOut, the reel easing the section tracker uses too.
const POWER2_IN_OUT = "cubic-bezier(0.65, 0, 0.35, 1)";

const pad = (n: number) => String(n).padStart(2, "0");

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Freeze a running tween where it is, so the next one starts from what is on
// screen rather than snapping.
function handOff(animation: Animation | null) {
  if (!animation) return;
  try {
    animation.commitStyles();
  } catch {
    // Detached or not rendered: nothing to keep.
  }
  animation.cancel();
}

export function SlideFocusBadge({ slides, index, visible, reveal }: SlideFocusBadgeProps) {
  const viewportRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLSpanElement>(null);
  const tweens = useRef<{ size: Animation | null; track: Animation | null }>({ size: null, track: null });
  const synced = useRef(false);
  const current = useRef({ index, visible });

  const update = useCallback((target: number, animate: boolean) => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track) return;
    const items = Array.from(track.children) as HTMLElement[];
    const item = items[Math.max(0, Math.min(target, items.length - 1))];
    if (!item) return;
    // Integer layout metrics keep the clip box and the offset in agreement,
    // so no sliver of a neighbouring label shows.
    const width = item.offsetWidth;
    const height = item.offsetHeight;
    const y = -(item.offsetTop - items[0].offsetTop);

    const running = tweens.current;
    handOff(running.size);
    handOff(running.track);
    running.size = null;
    running.track = null;

    if (!animate) {
      viewport.style.width = `${width}px`;
      viewport.style.height = `${height}px`;
      track.style.transform = `translate3d(0, ${y}px, 0)`;
      return;
    }

    const from = viewport.getBoundingClientRect();
    running.size = viewport.animate(
      [
        { width: `${from.width}px`, height: `${from.height}px` },
        { width: `${width}px`, height: `${height}px` },
      ],
      { duration: SIZE_TWEEN_S * 1000, easing: EASE.power2Out, fill: "both" },
    );
    const fromTransform = track.style.transform || "translate3d(0, 0, 0)";
    running.track = track.animate(
      [{ transform: fromTransform }, { transform: `translate3d(0, ${y}px, 0)` }],
      { duration: TRACK_TWEEN_S * 1000, easing: POWER2_IN_OUT, fill: "both" },
    );
  }, []);

  useLayoutEffect(() => {
    current.current = { index, visible };
    if (!visible) {
      // Next time it shows, it lands on the right label without rolling.
      synced.current = false;
      return;
    }
    update(index, synced.current && !prefersReducedMotion());
    synced.current = true;
  }, [index, visible, update]);

  useEffect(() => {
    const resync = () => {
      if (current.current.visible && synced.current) update(current.current.index, false);
    };
    window.addEventListener("resize", resync);
    document.fonts?.ready.then(resync).catch(() => {});
    const running = tweens.current;
    return () => {
      window.removeEventListener("resize", resync);
      running.size?.cancel();
      running.track?.cancel();
    };
  }, [update]);

  const shown = visible && reveal > 0.001;

  return (
    <div
      className={styles.badge}
      style={{ opacity: visible ? reveal : 0, visibility: shown ? "visible" : "hidden" }}
      aria-hidden="true"
    >
      <span ref={viewportRef} className={styles.viewport}>
        <span ref={trackRef} className={styles.track}>
          {slides.map((slide, i) => (
            <span key={slide.kicker} className={styles.item}>
              <span className={styles.count}>
                {pad(i + 1)} / {pad(slides.length)}
              </span>{" "}
              {slide.kicker}
            </span>
          ))}
        </span>
      </span>
    </div>
  );
}
