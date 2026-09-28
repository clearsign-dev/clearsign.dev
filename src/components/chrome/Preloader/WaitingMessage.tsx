"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { SplitText } from "@/components/reveal/SplitText";
import { EASE, isMobileMotionContext, scaleDuration } from "@/lib/motion/easings";
import styles from "./Preloader.module.css";

// One line of the loading sequence. Each letter rises out of its own mask
// while un-tilting and un-blurring; hiding plays the same motion backwards at
// twice the speed, last letter first. Mounted fresh for every showing.

const HIDDEN = "translate3d(0, 100%, 0) rotateX(-85deg) scale(0.96)";
const SHOWN = "translate3d(0, 0, 0) rotateX(0deg) scale(1)";
const REVEAL_S = 0.42;
const STAGGER_S = 0.006;
const HIDE_SPEED = 2;
const FADE_MS = 250;
// power3.out run backwards, so the hide is the reveal in reverse.
const POWER3_OUT_REVERSED = "cubic-bezier(0.645, 0, 0.785, 0.39)";

type WaitingMessageProps = {
  text: string;
  hiding: boolean;
  reduced: boolean;
  onShown: () => void;
  onHidden: () => void;
};

type Plan = { targets: HTMLElement[]; hidden: Keyframe; shown: Keyframe; durationMs: number; staggerMs: number };

function plan(root: HTMLElement, reduced: boolean): Plan {
  if (reduced) {
    return { targets: [root], hidden: { opacity: 0 }, shown: { opacity: 1 }, durationMs: FADE_MS, staggerMs: 0 };
  }
  const blur = !isMobileMotionContext();
  return {
    targets: Array.from(root.querySelectorAll<HTMLElement>(".char")),
    hidden: { opacity: 0, transform: HIDDEN, ...(blur ? { filter: "blur(8px)" } : {}) },
    shown: { opacity: 1, transform: SHOWN, ...(blur ? { filter: "blur(0px)" } : {}) },
    durationMs: scaleDuration(REVEAL_S) * 1000,
    staggerMs: scaleDuration(STAGGER_S) * 1000,
  };
}

function whenAllFinished(animations: Animation[], done: () => void): () => void {
  let cancelled = false;
  Promise.all(animations.map((a) => a.finished)).then(
    () => {
      if (!cancelled) done();
    },
    () => {},
  );
  return () => {
    cancelled = true;
    animations.forEach((a) => a.cancel());
  };
}

export function WaitingMessage({ text, hiding, reduced, onShown, onHidden }: WaitingMessageProps) {
  const ref = useRef<HTMLParagraphElement>(null);
  const callbacks = useRef({ onShown, onHidden });

  useEffect(() => {
    callbacks.current = { onShown, onHidden };
  });

  // Reveal on mount, before the first paint.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const { targets, hidden, shown, durationMs, staggerMs } = plan(root, reduced);
    const animations = targets.map((el, i) =>
      el.animate([hidden, shown], {
        duration: durationMs,
        delay: i * staggerMs,
        easing: reduced ? "ease" : EASE.power3Out,
        fill: "both",
      }),
    );
    return whenAllFinished(animations, () => callbacks.current.onShown());
  }, [reduced]);

  useEffect(() => {
    const root = ref.current;
    if (!hiding || !root) return;
    const { targets, hidden, shown, durationMs, staggerMs } = plan(root, reduced);
    const last = targets.length - 1;
    const animations = targets.map((el, i) =>
      el.animate([shown, hidden], {
        duration: durationMs / HIDE_SPEED,
        delay: ((last - i) * staggerMs) / HIDE_SPEED,
        easing: reduced ? "ease" : POWER3_OUT_REVERSED,
        fill: "both",
      }),
    );
    return whenAllFinished(animations, () => callbacks.current.onHidden());
  }, [hiding, reduced]);

  return (
    // Visual only: the shell announces the line through its own live region.
    <p ref={ref} className={styles.message} aria-hidden="true">
      <SplitText segments={text} mask charClassName={styles.messageChar} />
    </p>
  );
}
