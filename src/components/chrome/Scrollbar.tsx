"use client";

import { clsx } from "clsx";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { HERO_INTRO_PHASE, HERO_INTRO_PHASE_MOBILE } from "@/lib/motion/timing";
import { clamp01 } from "@/lib/motion/progress";
import { introPhase } from "@/lib/stage/intro";
import { goToProgress, scrollProgress, useStore } from "@/lib/stage/store";
import { useLayoutFlags } from "@/lib/stage/useLayoutFlags";
import styles from "./Scrollbar.module.css";

// The thin accent bar on the right edge. It shows while the page is moving,
// while hovered and while dragged, and fades out a moment after scrolling stops.

const IDLE_HIDE_MS = 1100;

export function Scrollbar() {
  const barRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef(0);
  const dragFrame = useRef(0);
  const pendingY = useRef(0);
  const draggingRef = useRef(false);

  const { isMobile } = useLayoutFlags();
  const phase = useStore(introPhase);
  const introVisible = isMobile
    ? phase >= HERO_INTRO_PHASE_MOBILE.scrollIndicator
    : phase >= HERO_INTRO_PHASE.uiGroup;
  const percent = useStore(scrollProgress, (p) => Math.round(clamp01(p) * 100));

  const [scrolling, setScrolling] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  const markScrolling = useCallback(() => {
    setScrolling(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setScrolling(false), IDLE_HIDE_MS);
  }, []);

  // The thumb is written straight to the DOM: progress changes every frame.
  useEffect(() => {
    const bar = barRef.current;
    const thumb = thumbRef.current;
    if (!bar || !thumb) return;

    let travel = 0;
    const place = () => {
      thumb.style.transform = `translate3d(0, ${clamp01(scrollProgress.get()) * travel}px, 0)`;
    };
    const measure = () => {
      travel = Math.max(0, bar.offsetHeight - thumb.offsetHeight);
      place();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    const unsubscribe = scrollProgress.subscribe(() => {
      place();
      markScrolling();
    });

    return () => {
      observer.disconnect();
      unsubscribe();
    };
  }, [markScrolling]);

  useEffect(
    () => () => {
      window.clearTimeout(idleTimer.current);
      cancelAnimationFrame(dragFrame.current);
    },
    [],
  );

  // Pointer y to progress, keeping the thumb's centre under the pointer.
  const progressAt = (clientY: number) => {
    const bar = barRef.current;
    if (!bar) return scrollProgress.get();
    const rect = bar.getBoundingClientRect();
    const thumbHeight = thumbRef.current?.offsetHeight ?? 0;
    return clamp01((clientY - rect.top - thumbHeight / 2) / Math.max(1, rect.height - thumbHeight));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    draggingRef.current = true;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    goToProgress(progressAt(event.clientY), { immediate: true });
    markScrolling();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    pendingY.current = event.clientY;
    if (dragFrame.current) return;
    dragFrame.current = requestAnimationFrame(() => {
      dragFrame.current = 0;
      goToProgress(progressAt(pendingY.current), { immediate: true });
    });
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    setDragging(false);
    cancelAnimationFrame(dragFrame.current);
    dragFrame.current = 0;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    markScrolling();
  };

  const visible = introVisible && (scrolling || hovered || dragging);

  return (
    <div
      ref={barRef}
      className={clsx(styles.scrollbar, visible && styles.visible, dragging && styles.dragging)}
      role="scrollbar"
      aria-orientation="vertical"
      aria-label="Page scroll progress"
      aria-controls="stage-scroll-wrapper"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={-1}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      <div className={styles.track} aria-hidden="true" />
      <div ref={thumbRef} className={styles.thumb} aria-hidden="true" />
    </div>
  );
}
