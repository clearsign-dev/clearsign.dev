"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type RefObject,
} from "react";
import { EVIDENCE } from "@/lib/content";
import type { Beat } from "@/lib/motion/progress";
import { cursor } from "@/lib/stage/store";
import { SlideCard, type EvidenceSlide } from "./SlideCard";
import { SlideTooltip, type SlideTooltipHandle } from "./SlideTooltip";
import { TrainController, type TrainInput } from "./trainController";
import type { TrainBand } from "./trainLayout";
import styles from "./EvidenceTrain.module.css";

// The evidence cards as a train travelling across the section: scroll carries
// it from the first card to the last, a drag scrubs it, arrow keys step it.

const SLIDES: readonly EvidenceSlide[] = EVIDENCE.slides;
const COUNT = SLIDES.length;
const DRAG_LABEL = "Drag";
// Clearance kept between the train and the copy above and below it.
const BAND_GAP = 16;

type EvidenceTrainProps = {
  /** Section progress (runs past 1 while the section is being left). */
  progress: number;
  slides: Beat;
  entryStart: number;
  exitEnd: number;
  isMobileTiming: boolean;
  /** Accessible name for the carousel. */
  label: string;
  focusedIndex: number;
  onFocusChange: (index: number) => void;
  onVisibleChange: (visible: boolean) => void;
  /** The section's copy, which the train keeps clear of on narrow layouts. */
  wrapRef: RefObject<HTMLElement | null>;
  descRef: RefObject<HTMLElement | null>;
};

function claimCursor() {
  const current = cursor.get();
  if (current.label !== DRAG_LABEL || !current.active) cursor.set({ label: DRAG_LABEL, active: true });
}

function releaseCursor() {
  if (cursor.get().label === DRAG_LABEL) cursor.set({ label: null, active: false });
}

function cardIndexOf(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null;
  const card = target.closest<HTMLElement>("[data-slide-index]");
  if (!card) return null;
  const index = Number(card.dataset.slideIndex);
  return Number.isInteger(index) ? index : null;
}

export function EvidenceTrain({
  progress,
  slides,
  entryStart,
  exitEnd,
  isMobileTiming,
  label,
  focusedIndex,
  onFocusChange,
  onVisibleChange,
  wrapRef,
  descRef,
}: EvidenceTrainProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const bandRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<(HTMLDivElement | null)[]>(new Array(COUNT).fill(null));
  const tooltipRef = useRef<SlideTooltipHandle>(null);
  const controllerRef = useRef<TrainController | null>(null);
  const inputRef = useRef<TrainInput>({ progress, slides, entryStart, exitEnd });
  const callbacksRef = useRef({ onFocusChange, onVisibleChange });
  const [hasFocus, setHasFocus] = useState(false);
  // Last mouse position over the train, for re-checking the hover as it moves.
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const tooltipEnabledRef = useRef(!isMobileTiming);

  const registerCard = useCallback((index: number, el: HTMLDivElement | null) => {
    cardsRef.current[index] = el;
  }, []);

  // Show the title of the card under the cursor, or nothing between cards.
  const updateHover = useCallback((x: number, y: number, target: EventTarget | null) => {
    const tooltip = tooltipRef.current;
    const controller = controllerRef.current;
    if (!tooltip) return;
    const index = controller?.isInteractive() ? cardIndexOf(target) : null;
    if (index === null) tooltip.hide();
    else tooltip.show(SLIDES[index].title, x, y);
  }, []);

  // Keep the latest props where the frame loop can read them.
  useLayoutEffect(() => {
    callbacksRef.current = { onFocusChange, onVisibleChange };
    tooltipEnabledRef.current = !isMobileTiming;
  });

  useLayoutEffect(() => {
    const input = { progress, slides, entryStart, exitEnd };
    inputRef.current = input;
    controllerRef.current?.setInput(input);
  }, [progress, slides, entryStart, exitEnd]);

  useEffect(() => {
    const stage = stageRef.current;
    const band = bandRef.current;
    if (!stage || !band) return;

    // Narrow layouts: the train sits between the description and the heading.
    const measureBand = (): TrainBand | null => {
      const wrap = wrapRef.current;
      const desc = descRef.current;
      if (!wrap || !desc) return null;
      const heading = wrap.querySelector<HTMLElement>("h2");
      const top = wrap.offsetTop + desc.offsetTop + desc.offsetHeight + BAND_GAP;
      const bottom = heading ? wrap.offsetTop + heading.offsetTop - BAND_GAP : stage.clientHeight - 96;
      return { top, bottom };
    };

    const controller = new TrainController(
      { stage, band, cards: cardsRef.current },
      {
        onFocusChange: (index) => callbacksRef.current.onFocusChange(index),
        onVisibleChange: (visible) => callbacksRef.current.onVisibleChange(visible),
        onInteractiveChange: (interactive) => {
          if (interactive) return;
          tooltipRef.current?.hide();
          releaseCursor();
        },
        onDragChange: (dragging) => {
          if (dragging) tooltipRef.current?.hide();
        },
        onMovedUnderPointer: () => {
          const at = hoverRef.current;
          if (!at || !tooltipEnabledRef.current) return;
          updateHover(at.x, at.y, document.elementFromPoint(at.x, at.y));
        },
        measureBand,
      },
      COUNT,
      inputRef.current,
    );
    controllerRef.current = controller;

    const resize = () => controller.resize();
    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    if (wrapRef.current) observer.observe(wrapRef.current);
    if (descRef.current) observer.observe(descRef.current);
    window.addEventListener("resize", resize);
    let alive = true;
    document.fonts?.ready
      .then(() => {
        if (alive) resize();
      })
      .catch(() => {});

    return () => {
      alive = false;
      observer.disconnect();
      window.removeEventListener("resize", resize);
      controller.destroy();
      controllerRef.current = null;
      releaseCursor();
    };
  }, [wrapRef, descRef, updateHover]);

  // Layout tiers change the geometry and the free band.
  useLayoutEffect(() => {
    controllerRef.current?.resize();
  }, [isMobileTiming]);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    controllerRef.current?.pointerDown(event.pointerId, event.clientX, event.clientY, cardIndexOf(event.target));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const controller = controllerRef.current;
    if (!controller) return;
    const result = controller.pointerMove(event.pointerId, event.clientX, event.clientY);
    if (result === "started") {
      try {
        bandRef.current?.setPointerCapture(event.pointerId);
      } catch {
        // The pointer is already gone.
      }
    }
    if (result !== "idle" || controller.isDragging()) return;

    // Hover: the card's title follows a mouse cursor on desktop.
    if (event.pointerType !== "mouse" || isMobileTiming) {
      hoverRef.current = null;
      tooltipRef.current?.hide();
      return;
    }
    hoverRef.current = { x: event.clientX, y: event.clientY };
    updateHover(event.clientX, event.clientY, event.target);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    controllerRef.current?.pointerUp(event.pointerId, event.clientX, event.clientY);
  };

  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    controllerRef.current?.pointerCancel(event.pointerId);
  };

  const onPointerOver = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    if (controllerRef.current?.isInteractive()) claimCursor();
  };

  const onPointerLeave = () => {
    hoverRef.current = null;
    tooltipRef.current?.hide();
    if (!controllerRef.current?.isDragging()) releaseCursor();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const controller = controllerRef.current;
    if (!controller) return;
    switch (event.key) {
      case "ArrowRight":
        controller.step(1);
        break;
      case "ArrowLeft":
        controller.step(-1);
        break;
      case "Home":
        controller.goTo(0);
        break;
      case "End":
        controller.goTo(COUNT - 1);
        break;
      default:
        return;
    }
    // Home/End would otherwise also jump the whole page.
    event.preventDefault();
    event.stopPropagation();
  };

  const current = SLIDES[Math.max(0, Math.min(focusedIndex, COUNT - 1))];

  return (
    <div className={styles.root}>
      <div
        ref={stageRef}
        className={styles.stage}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        aria-keyshortcuts="ArrowLeft ArrowRight Home End"
        tabIndex={0}
        data-carousel=""
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerOver={onPointerOver}
        onPointerLeave={onPointerLeave}
        onKeyDown={onKeyDown}
        onFocus={() => setHasFocus(true)}
        onBlur={() => setHasFocus(false)}
      >
        <div ref={bandRef} className={styles.band} data-cursor="grab" aria-hidden="true" />
        {SLIDES.map((slide, i) => (
          <SlideCard
            key={slide.kicker}
            slide={slide}
            index={i}
            count={COUNT}
            focused={i === focusedIndex}
            hint={isMobileTiming && i === focusedIndex}
            register={registerCard}
          />
        ))}
        <p className="sr-only" aria-live={hasFocus ? "polite" : "off"} aria-atomic="true">
          {hasFocus
            ? `Slide ${focusedIndex + 1} of ${COUNT}. ${current.kicker}: ${current.figure}, ${current.title}.`
            : ""}
        </p>
      </div>
      <SlideTooltip ref={tooltipRef} />
    </div>
  );
}
