"use client";

import Lenis from "lenis";
import { useEffect, useRef, type ComponentType, type ReactNode } from "react";
import { playSfx } from "@/lib/audio/sfx";
import { sectionRevealTable } from "@/lib/motion/timing";
import {
  BASE_VIRTUAL_SCROLL_HEIGHT,
  MOBILE_SCROLL_HEIGHT_SCALE,
  OUTGOING_HOLDOVER,
  SECTIONS,
  SECTION_COUNT,
  globalAt,
  isSectionMounted,
  progressAt,
  sectionProgressFor,
} from "@/lib/stage/sections";
import {
  canScroll,
  goToSection,
  registerNavigator,
  scrollProgress,
  stageProgress,
  useStore,
} from "@/lib/stage/store";
import { readLayoutFlags, useLayoutFlags } from "@/lib/stage/useLayoutFlags";
import styles from "./Stage.module.css";

export type SectionProps = {
  /** 0..1 through this section; runs past 1 while it is the one just left. */
  progress: number;
  /** ≤ 1024px: the reference switches choreography here. */
  isMobileTiming: boolean;
  /** ≤ 766px. */
  isPhoneTiming: boolean;
};

type StageProps = {
  /** One component per entry in SECTIONS, in order. */
  sections: ComponentType<SectionProps>[];
  /** Fixed chrome drawn above the scroll track (header, indicator, scene...). */
  children?: ReactNode;
};

// Lenis tuning read from the reference.
const DESKTOP_LENIS = { lerp: 0.055, wheelMultiplier: 0.48, touchMultiplier: 0.85 } as const;
const MOBILE_LENIS = { lerp: 0.07, wheelMultiplier: 0.4 } as const;
const WHEEL_SOFT_CAP = { desktop: 30, mobile: 26 } as const;

// Programmatic jumps: 0.9s for a neighbour, up to 1.8s across the whole page.
const MIN_JUMP_S = 0.9;
const MAX_JUMP_S = 1.8;

// A blend of linear and smootherstep, so a jump starts moving at once
// instead of easing in from a standstill.
const responsiveStep = (value: number) => {
  const t = Math.max(0, Math.min(1, value));
  const smooth = t * t * t * (t * (t * 6 - 15) + 10);
  return t * 0.22 + smooth * 0.78;
};

const compressWheel = (deltaY: number, cap: number) =>
  Math.sign(deltaY) * cap * Math.tanh(Math.abs(deltaY) / cap);

export function Stage({ sections, children }: StageProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const progress = useStore(stageProgress);
  const { isMobile, isPhone, isTouch } = useLayoutFlags();
  const scrollEnabled = useStore(canScroll);
  const lenisRef = useRef<Lenis | null>(null);

  const trackHeight = Math.round(
    BASE_VIRTUAL_SCROLL_HEIGHT * (isMobile || isTouch ? MOBILE_SCROLL_HEIGHT_SCALE : 1),
  );

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const content = contentRef.current;
    if (!wrapper || !content) return;

    const flags = readLayoutFlags();
    const mobile = flags.isMobile || flags.isTouch;
    const cap = mobile ? WHEEL_SOFT_CAP.mobile : WHEEL_SOFT_CAP.desktop;

    const lenis = new Lenis({
      wrapper,
      content,
      eventsTarget: wrapper,
      gestureOrientation: "vertical",
      smoothWheel: true,
      overscroll: false,
      autoRaf: false,
      lerp: mobile ? MOBILE_LENIS.lerp : DESKTOP_LENIS.lerp,
      wheelMultiplier: mobile ? MOBILE_LENIS.wheelMultiplier : DESKTOP_LENIS.wheelMultiplier,
      syncTouch: !mobile,
      syncTouchLerp: DESKTOP_LENIS.lerp,
      touchMultiplier: DESKTOP_LENIS.touchMultiplier,
      virtualScroll: (data) => {
        const isTouch = typeof TouchEvent !== "undefined" && data.event instanceof TouchEvent;
        if (!isTouch) data.deltaY = compressWheel(data.deltaY, cap);
        return true;
      },
    });
    lenisRef.current = lenis;

    let lastStep = stageProgress.get().step;
    const publish = (animatedScroll: number) => {
      const max = Math.max(1, lenis.limit);
      const global = Math.max(0, Math.min(1, animatedScroll / max));
      scrollProgress.set(global);
      const next = progressAt(global);
      const prev = stageProgress.get();
      if (
        next.step !== prev.step ||
        Math.abs(next.value - prev.value) > 0.000025 ||
        next.global !== prev.global
      ) {
        stageProgress.set(next);
      }
      if (next.step !== lastStep) {
        lastStep = next.step;
        playSfx("transition");
      }
    };
    lenis.on("scroll", (l: Lenis) => publish(l.animatedScroll));

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let lastRequest = { index: -1, at: 0 };
    registerNavigator({
      toSection(index, options) {
        if (!canScroll.get()) return;
        const i = Math.max(0, Math.min(SECTION_COUNT - 1, index));
        const now = performance.now();
        if (i === lastRequest.index && now - lastRequest.at < 280) return;
        lastRequest = { index: i, at: now };
        const flags = readLayoutFlags();
        const reveal = sectionRevealTable(flags.isMobile, flags.isContactStacked);
        this.toProgress(globalAt(i, reveal[i] ?? 0), options);
      },
      toProgress(global, options) {
        if (!canScroll.get()) return;
        const target = Math.max(0, Math.min(1, global)) * lenis.limit;
        const distance = Math.abs(target - lenis.animatedScroll) / Math.max(1, lenis.limit);
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        lenis.scrollTo(target, {
          duration: MIN_JUMP_S + (MAX_JUMP_S - MIN_JUMP_S) * Math.sqrt(distance),
          easing: responsiveStep,
          immediate: Boolean(options?.immediate) || reduced,
          lock: !options?.immediate,
          force: true,
        });
      },
    });

    // Keyboard: one key press moves one section.
    const onKey = (event: KeyboardEvent) => {
      if (!canScroll.get() || event.defaultPrevented) return;
      const origin = event.target as HTMLElement | null;
      // Controls that use the keys themselves keep them (fields, sliders, the sound pill).
      if (origin?.closest("input, textarea, select, [contenteditable='true'], [role='slider'], [data-own-keys]")) return;
      const step = stageProgress.get().step;
      let target: number | null = null;
      if (["ArrowDown", "PageDown"].includes(event.key) || (event.key === " " && !event.shiftKey)) {
        target = step + 1;
      } else if (["ArrowUp", "PageUp"].includes(event.key) || (event.key === " " && event.shiftKey)) {
        target = step - 1;
      } else if (event.key === "Home") {
        target = 0;
      } else if (event.key === "End") {
        target = SECTION_COUNT - 1;
      }
      if (target === null) return;
      event.preventDefault();
      if (target >= 0 && target < SECTION_COUNT) goToSection(target);
    };
    window.addEventListener("keydown", onKey);

    const html = document.documentElement;
    const previousOverflow = [html.style.overflow, document.body.style.overflow];
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    lenis.scrollTo(0, { immediate: true, force: true });
    publish(0);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKey);
      registerNavigator(null);
      lenis.destroy();
      lenisRef.current = null;
      [html.style.overflow, document.body.style.overflow] = previousOverflow;
    };
  }, []);

  // Scrolling is locked until the intro has played far enough.
  useEffect(() => {
    const lenis = lenisRef.current;
    if (!lenis) return;
    if (scrollEnabled) {
      lenis.start();
    } else {
      lenis.stop();
      lenis.scrollTo(0, { immediate: true, force: true });
    }
  }, [scrollEnabled]);

  // The track height changes with layout; Lenis needs to re-measure.
  useEffect(() => {
    lenisRef.current?.resize();
  }, [trackHeight]);

  const contactActive = SECTIONS[progress.step]?.id === "contact";

  return (
    <div ref={wrapperRef} className={styles.wrapper} id="stage-scroll-wrapper">
      <div ref={contentRef} className={styles.track} style={{ height: trackHeight }} />
      {children}
      <main
        className={`${styles.sections} ${contactActive ? styles.sectionsContact : ""}`}
      >
        {SECTIONS.map((section, i) => {
          const Component = sections[i];
          const mounted = isSectionMounted(i, progress.step);
          const active = progress.step === i;
          const outgoing = progress.step === i + 1 && OUTGOING_HOLDOVER.has(section.id);
          return (
            <section
              key={section.id}
              id={`section-${i}`}
              data-section={section.id}
              aria-label={section.indicatorLabel}
              aria-hidden={!active}
              inert={!active}
              className={[
                styles.section,
                "stage-section",
                mounted ? styles.nearby : "",
                active ? styles.active : "",
                outgoing ? styles.outgoing : "",
              ].join(" ")}
            >
              {mounted && Component ? (
                <Component
                  progress={sectionProgressFor(i, progress)}
                  isMobileTiming={isMobile}
                  isPhoneTiming={isPhone}
                />
              ) : null}
            </section>
          );
        })}
      </main>
    </div>
  );
}
