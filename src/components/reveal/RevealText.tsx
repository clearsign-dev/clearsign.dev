"use client";

import { useMemo, useRef, useState, type ElementType } from "react";
import { EASE, isMobileMotionContext, powerOut, prefersReducedMotion, scaleDuration } from "@/lib/motion/easings";
import { SplitText, segmentsText, type Segment } from "./SplitText";
import { useScrubbedReveal } from "./useScrubbedReveal";

// Body-copy reveal. On desktop each character fades up out of a slight blur;
// on touch and narrow layouts whole lines rise together, which is cheaper and
// reads better on a small screen.

type RevealTextProps = {
  segments: Segment | Segment[];
  /** Scroll mode: 0..1. When omitted, `visible` plays the reveal in real time. */
  progress?: number;
  visible?: boolean;
  /** Seconds per target. Default 0.9. */
  duration?: number;
  /** Seconds between targets; defaults per mode (chars 0.008, lines 0.055). */
  stagger?: number;
  /** Raise the scrub progress to this power: slows the start of the reveal. */
  progressPower?: number;
  /** Vertical offset characters rise from. Default 0.4em (lines 0.72em). */
  offsetY?: string;
  offsetX?: string;
  /** false animates the element as one block. */
  split?: boolean;
  as?: ElementType;
  className?: string;
};

const BAKE_STEPS = 24;

function scale(value: string, factor: number): string {
  const m = /^(-?[\d.]+)([a-z%]*)$/i.exec(value.trim());
  return m ? `${parseFloat(m[1]) * factor}${m[2] || "px"}` : value;
}

// GSAP's power2.out cannot be expressed by the timeline's own easing without
// losing the blur/opacity coupling, so it is baked into keyframes.
function charKeyframes(offsetX: string, offsetY: string, blur: boolean): Keyframe[] {
  const frames: Keyframe[] = [];
  for (let i = 0; i <= BAKE_STEPS; i++) {
    const p = i / BAKE_STEPS;
    const e = powerOut[2](p);
    const frame: Keyframe = {
      offset: p,
      opacity: e,
      transform: `translate(${scale(offsetX, 1 - e)}, ${scale(offsetY, 1 - e)})`,
      visibility: i === 0 ? "hidden" : "visible",
    };
    if (blur) frame.filter = e >= 1 ? "blur(0px)" : `blur(${8 * (1 - e)}px)`;
    frames.push(frame);
  }
  return frames;
}

function lineKeyframes(offsetY: string): Keyframe[] {
  const t = (f: number, rx: number, sy: number) =>
    `perspective(900px) translate3d(0, ${scale(offsetY, f)}, 0) rotateX(${rx}deg) scaleY(${sy})`;
  return [
    { offset: 0, transform: t(1, -7, 0.96), opacity: 0, visibility: "hidden" },
    { offset: 0.001, transform: t(1, -7, 0.96), opacity: 0.01, visibility: "visible", easing: EASE.lineReveal },
    { offset: 0.84, transform: t(0.008, 0.2, 1.004), opacity: 1, easing: EASE.outQuart },
    { offset: 1, transform: t(0, 0, 1), opacity: 1 },
  ];
}

// Group word spans into visual lines by their offsetTop, so every word in a
// line starts together.
function lineStagger(step: number) {
  let cache: { targets: HTMLElement[]; lines: number[] } | null = null;
  return (index: number, targets: HTMLElement[]) => {
    if (!cache || cache.targets !== targets) {
      const tops: number[] = [];
      const lines = targets.map((el) => {
        const top = el.offsetTop;
        let line = tops.findIndex((t) => Math.abs(t - top) <= 2);
        if (line === -1) {
          tops.push(top);
          line = tops.length - 1;
        }
        return line;
      });
      cache = { targets, lines };
    }
    return cache.lines[index] * step;
  };
}

export function RevealText({
  segments,
  progress,
  visible = true,
  duration = 0.9,
  stagger,
  progressPower,
  offsetY,
  offsetX = "0em",
  split = true,
  as: Tag = "p",
  className = "",
}: RevealTextProps) {
  const ref = useRef<HTMLElement>(null);
  const [mode] = useState<"character" | "line" | "block">(() =>
    !split || prefersReducedMotion() ? "block" : isMobileMotionContext() ? "line" : "character",
  );

  const blur = mode === "character";
  const y = offsetY ?? (mode === "line" ? "0.72em" : mode === "character" ? "0.4em" : "16px");

  const keyframes = useMemo(() => {
    if (mode === "line") return () => lineKeyframes(y);
    if (mode === "block") return () => charKeyframes("0px", prefersReducedMotion() ? "0px" : y, false);
    return () => charKeyframes(offsetX, y, blur);
  }, [mode, offsetX, y, blur]);

  const staggerFn = useMemo(
    () => (mode === "line" ? lineStagger(scaleDuration(stagger ?? 0.055, 1.2)) : null),
    [mode, stagger],
  );

  useScrubbedReveal(ref, {
    selector: mode === "character" ? ".char" : mode === "line" ? ".word" : ":scope > .reveal-block",
    keyframes,
    duration: scaleDuration(duration),
    stagger: staggerFn ?? (mode === "block" ? 0 : scaleDuration(stagger ?? 0.008, 1.2)),
    // Curves are baked into the keyframes, so the timeline itself runs linear.
    easing: "linear",
    progress,
    playing: typeof progress === "number" ? undefined : visible,
    progressPower,
    rebuildKey: `${mode}:${duration}:${stagger}:${y}:${JSON.stringify(segments)}`,
  });

  // Screen readers get the sentence once; the split glyphs are hidden from
  // them, or they would be read out letter by letter.
  return (
    <Tag ref={ref} className={className}>
      <span className="sr-only">{segmentsText(segments)}</span>
      {mode === "block" ? (
        <span className="reveal-block" style={{ display: "inline-block" }} aria-hidden="true">
          <SplitText segments={segments} />
        </span>
      ) : (
        <span aria-hidden="true">
          <SplitText segments={segments} />
        </span>
      )}
    </Tag>
  );
}
