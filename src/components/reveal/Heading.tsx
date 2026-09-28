"use client";

import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import { EASE, isMobileMotionContext, prefersReducedMotion, scaleDuration } from "@/lib/motion/easings";
import { SplitText } from "./SplitText";
import { useScrubbedReveal } from "./useScrubbedReveal";
import styles from "./Heading.module.css";

// The display heading. Each character sits in its own mask and rises from
// below while un-tilting from -85° and un-blurring, one after another.

export type HeadingMotion = { duration?: number; stagger?: number };

type HeadingProps = {
  lines: string[];
  /** Scroll mode: 0..1. When omitted, `visible` plays the reveal in real time. */
  progress?: number;
  visible?: boolean;
  motion?: HeadingMotion;
  /** Footnote-style marker, e.g. "2" renders as [2] at the bottom right. */
  sup?: string;
  /** Pin to the bottom of the section. */
  position?: "top" | "bottom";
  /** Dark, glassy fill with a glow that follows the pointer. */
  inverted?: boolean;
  as?: ElementType;
  className?: string;
  lineClassName?: string;
  /** Called once, `offset` seconds before a forward play ends. */
  onBeforeEnd?: { offset: number; callback: () => void };
};

const HIDDEN = "translate3d(0, 100%, 0) rotateX(-85deg) scale(0.96)";
const SHOWN = "translate3d(0, 0, 0) rotateX(0deg) scale(1)";
const DRIFT_RANGE = 34;
const DRIFT_SMOOTHING = 0.11;

export function Heading({
  lines,
  progress,
  visible = true,
  motion,
  sup,
  position = "top",
  inverted = false,
  as: Tag = "h2",
  className = "",
  lineClassName = "",
  onBeforeEnd,
}: HeadingProps) {
  const ref = useRef<HTMLElement>(null);
  const [mobile] = useState(() => isMobileMotionContext());
  const [reduced] = useState(() => prefersReducedMotion());

  const duration = scaleDuration(motion?.duration ?? 1.2);
  const stagger = scaleDuration(motion?.stagger ?? 0.02, 1.18);
  const blur = !mobile && !reduced;

  const keyframes = useMemo(
    () => () =>
      reduced
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: HIDDEN, ...(blur ? { filter: "blur(8px)" } : {}) },
            { opacity: 1, transform: SHOWN, ...(blur ? { filter: "blur(0px)" } : {}) },
          ],
    [blur, reduced],
  );

  useScrubbedReveal(ref, {
    selector: ".char",
    keyframes,
    duration: reduced ? 0.3 : duration,
    stagger: reduced ? 0 : stagger,
    easing: EASE.power3Out,
    progress,
    playing: typeof progress === "number" ? undefined : visible,
    onBeforeEnd,
    rebuildKey: `${lines.join("|")}:${duration}:${stagger}:${blur}`,
  });

  // The fill follows the pointer a little, so the letters feel lit rather than printed.
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
      const strength = Math.min(Math.hypot(cx, cy) / DRIFT_RANGE, 1);
      el.style.setProperty("--heading-drift-x", `${Math.round(cx)}px`);
      el.style.setProperty("--heading-drift-y", `${Math.round(cy)}px`);
      el.style.setProperty("--heading-focus-x", `${Math.round(50 + (cx / DRIFT_RANGE) * 18)}%`);
      el.style.setProperty("--heading-focus-y", `${Math.round(50 + (cy / DRIFT_RANGE) * 24)}%`);
      el.style.setProperty("--heading-glow-alpha", (active ? 0.22 + strength * 0.16 : 0.18).toFixed(2));
    };
    const tick = () => {
      const dx = tx - cx;
      const dy = ty - cy;
      cx += dx * DRIFT_SMOOTHING;
      cy += dy * DRIFT_SMOOTHING;
      paint();
      if (Math.abs(dx) < 0.08 && Math.abs(dy) < 0.08) {
        frame = 0;
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      tx = (event.clientX / window.innerWidth - 0.5) * DRIFT_RANGE;
      ty = (event.clientY / window.innerHeight - 0.5) * DRIFT_RANGE;
      active = true;
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      active = false;
      tx = 0;
      ty = 0;
      if (!frame) frame = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  const effective = typeof progress === "number" ? progress : visible ? 1 : 0;

  return (
    <>
      <Tag
        ref={ref}
        className={[
          styles.heading,
          position === "bottom" ? styles.bottom : "",
          inverted ? styles.inverted : "",
          className,
        ].join(" ")}
      >
        <span className="sr-only">{lines.join(" ")}</span>
        <span className={styles.inner} aria-hidden="true">
          {lines.map((line, i) => (
            <span key={i} className={`text-line ${styles.line} ${lineClassName}`}>
              <SplitText segments={line} mask charClassName={styles.char} />
            </span>
          ))}
        </span>
      </Tag>
      {sup ? (
        <sup
          className={styles.sup}
          style={{
            opacity: effective >= 1 ? 0 : 1,
            transform: effective >= 1 ? "scale(0.6)" : "scale(1)",
          }}
          aria-hidden="true"
        >
          [<span>{sup}</span>]
        </sup>
      ) : null}
    </>
  );
}
