"use client";

import { clsx } from "clsx";
import {
  useEffect,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { playSfx } from "@/lib/audio/sfx";
import { clamp01 } from "@/lib/motion/progress";
import { HERO_INTRO_PHASE, HERO_INTRO_PHASE_MOBILE, SECTION_REVEAL_COMPLETE, sectionRevealTable } from "@/lib/motion/timing";
import { introPhase } from "@/lib/stage/intro";
import { SECTIONS, SECTION_COUNT } from "@/lib/stage/sections";
import { goToProgress, goToSection, stageProgress, useStore } from "@/lib/stage/store";
import { useLayoutFlags } from "@/lib/stage/useLayoutFlags";
import styles from "./ScrollIndicator.module.css";

// The tick ruler at the top centre. One tall tick per section with three short
// ones between. The accent tick is the active section; the small marks above
// and below follow the page, arriving on a section's tick as that section
// finishes revealing. Hovering magnifies the ticks around the pointer and names
// the nearest section; clicking a tick goes there; dragging scrubs the page.

const SMALL_PER_GAP = 3;
const DRAG_THRESHOLD_PX = 6;

type Tick = { big: true; section: number } | { big: false };

const TICKS: Tick[] = SECTIONS.flatMap((s): Tick[] =>
  s.index < SECTION_COUNT - 1
    ? [{ big: true, section: s.index }, ...Array.from({ length: SMALL_PER_GAP }, (): Tick => ({ big: false }))]
    : [{ big: true, section: s.index }],
);

/** Position in TICKS of each section's tick. */
const BIG_TICK = TICKS.flatMap((t, i) => (t.big ? [i] : []));

// ---------------------------------------------------------------------------
// Motion helpers

/** A damped spring stepped in 60 fps frame units, like the reference's. */
type Spring = { value: number; previous: number; target: number; settled: boolean };
type SpringConfig = { stiffness: number; damping: number; precision: number };

const HEAD_SPRING: SpringConfig = { stiffness: 0.2, damping: 0.88, precision: 0.01 };
const FOCUS_SPRING: SpringConfig = { stiffness: 0.18, damping: 0.86, precision: 0.01 };

function snapSpring(spring: Spring, value: number) {
  spring.value = spring.previous = spring.target = value;
  spring.settled = true;
}

function stepSpring(spring: Spring, config: SpringConfig, frames: number) {
  const offset = spring.target - spring.value;
  const velocity = (spring.value - spring.previous) / frames;
  const acceleration = config.stiffness * offset - config.damping * velocity;
  const move = (velocity + acceleration) * frames;
  if (Math.abs(move) < config.precision && Math.abs(offset) < config.precision) {
    snapSpring(spring, spring.target);
    return;
  }
  spring.previous = spring.value;
  spring.value += move;
  spring.settled = false;
}

/**
 * Where the position marks sit for each global progress. They rest on a
 * section's tick, and slide to the next tick over that section's reveal,
 * landing when its UI is fully shown (the same point a tick click lands on).
 */
type MarkTrack = { at: number[]; px: number[] };

function buildTrack(bigCenters: number[], reveal: readonly number[]): MarkTrack {
  if (bigCenters.length < SECTION_COUNT) return { at: [], px: [] };
  const at = [SECTIONS[0].start];
  const px = [bigCenters[0]];
  for (let i = 1; i < SECTION_COUNT; i++) {
    const { start, end } = SECTIONS[i];
    at.push(start, start + (end - start) * clamp01(reveal[i] ?? 0));
    px.push(bigCenters[i - 1], bigCenters[i]);
  }
  at.push(SECTIONS[SECTION_COUNT - 1].end);
  px.push(bigCenters[SECTION_COUNT - 1]);
  return { at, px };
}

function lerpAcross(from: number[], to: number[], value: number, k: number): number {
  const span = from[k] - from[k - 1];
  const t = span > 1e-6 ? (value - from[k - 1]) / span : 1;
  return to[k - 1] + (to[k] - to[k - 1]) * t;
}

/** Global progress to x. */
function trackX({ at, px }: MarkTrack, progress: number): number {
  if (!at.length) return 0;
  if (progress <= at[0]) return px[0];
  for (let k = 1; k < at.length; k++) {
    if (progress <= at[k]) return lerpAcross(at, px, progress, k);
  }
  return px[px.length - 1];
}

/**
 * x to global progress, for scrubbing. Takes the first stretch that reaches
 * x, so dropping onto a tick lands at that section's reveal, not at the end
 * of its hold (which already belongs to the next section).
 */
function trackProgress({ at, px }: MarkTrack, x: number): number {
  if (at.length < 2) return 0;
  if (x <= px[0]) return at[0];
  for (let k = 1; k < px.length; k++) {
    if (px[k] >= x) return lerpAcross(px, at, x, k);
  }
  return at[at.length - 1];
}

function nearestIndex(centers: number[], x: number): number {
  let best = 0;
  for (let i = 1; i < centers.length; i++) {
    if (Math.abs(x - centers[i]) < Math.abs(x - centers[best])) best = i;
  }
  return best;
}

// Tick magnifier: a wave centred on the focus x. Near ticks grow and brighten,
// a ring just outside dips below rest size, far ticks dim.
const WAVE = {
  big: { radius: 70, scale: 0.85, glow: 0.5 },
  small: { radius: 60, scale: 0.65, glow: 0.2 },
} as const;
const REST = { scale: "1", opacity: "0.6", glow: "0" };

function waveAt(distance: number, big: boolean) {
  const w = big ? WAVE.big : WAVE.small;
  const x = distance / w.radius;
  const influence = (1 - x * x) * Math.exp(-0.5 * x * x);
  const lift = Math.max(0, influence);
  return {
    scale: Math.max(0.4, 1 + influence * w.scale).toFixed(3),
    opacity: Math.min(1, 0.25 + lift * 0.75).toFixed(3),
    glow: (lift * w.glow).toFixed(3),
  };
}

// ---------------------------------------------------------------------------
// The frame loop. It lives outside React: it writes transforms and CSS
// variables straight to the DOM while anything is moving, then stops.

/** What the loop reads from the component. */
type Live = {
  inside: boolean;
  dragging: boolean;
  pointerX: number | null;
  emphasized: number | null;
  shown: number;
  reveal: readonly number[];
};

type Engine = ReturnType<typeof createEngine>;

function createEngine(parts: {
  ticksEl: HTMLElement;
  headEl: HTMLElement;
  emphasisEl: HTMLElement;
  live: Live;
}) {
  const { ticksEl, headEl, emphasisEl, live } = parts;
  // Rendered once in TICKS order and never re-keyed.
  const tickEls = Array.from(ticksEl.querySelectorAll<HTMLElement>("[data-tick]"));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let centers: number[] = [];
  let bigCenters: number[] = [];
  let track: MarkTrack = { at: [], px: [] };
  let width = 0;

  const head: Spring = { value: 0, previous: 0, target: 0, settled: true };
  const focus: Spring = { value: 0, previous: 0, target: 0, settled: true };
  let headPlaced = false;

  const written = TICKS.map(() => ({ ...REST }));
  let writtenHead = "";
  let writtenEmphasis = "";

  let frameId = 0;
  let lastTime = 0;

  function measure() {
    const box = ticksEl.getBoundingClientRect();
    width = box.width;
    centers = tickEls.map((el) => el.getBoundingClientRect().left - box.left + el.offsetWidth / 2);
    bigCenters = BIG_TICK.map((i) => centers[i] ?? 0);
    track = buildTrack(bigCenters, live.reveal);
    if (width === 0) headPlaced = false;
    kick();
  }

  function kick() {
    if (!frameId) frameId = requestAnimationFrame(frame);
  }

  function writeTicks(origin: number | null) {
    for (let i = 0; i < TICKS.length; i++) {
      const el = tickEls[i];
      if (!el) continue;
      const next = origin === null ? REST : waveAt(Math.abs((centers[i] ?? 0) - origin), TICKS[i].big);
      const prev = written[i];
      if (next.scale !== prev.scale) el.style.setProperty("--tick-scale", (prev.scale = next.scale));
      if (next.opacity !== prev.opacity) el.style.setProperty("--tick-opacity", (prev.opacity = next.opacity));
      if (next.glow !== prev.glow) el.style.setProperty("--tick-glow", (prev.glow = next.glow));
    }
  }

  function frame(now: number) {
    frameId = 0;
    const frames = lastTime ? Math.min(2, Math.max(0.1, (now - lastTime) * 0.06)) : 1;
    lastTime = now;
    if (width === 0 || bigCenters.length < SECTION_COUNT) {
      lastTime = 0;
      return;
    }
    const reduced = reducedMotion.matches;

    // Position marks.
    head.target = trackX(track, stageProgress.get().global);
    if (!headPlaced || live.dragging || reduced) {
      snapSpring(head, head.target);
      headPlaced = true;
    } else {
      stepSpring(head, HEAD_SPRING, frames);
    }
    const headTransform = `translate3d(${head.value.toFixed(2)}px, 0, 0)`;
    if (headTransform !== writtenHead) headEl.style.transform = writtenHead = headTransform;

    // Magnifier focus: the pointer, else the emphasised tick.
    const interacting = live.inside || live.emphasized !== null;
    if (live.inside && live.pointerX !== null) focus.target = live.pointerX;
    else if (live.emphasized !== null) focus.target = bigCenters[live.emphasized] ?? focus.target;
    if (reduced) snapSpring(focus, focus.target);
    else stepSpring(focus, FOCUS_SPRING, frames);

    writeTicks(interacting ? focus.value : null);

    const first = bigCenters[0];
    const last = bigCenters[bigCenters.length - 1];
    const emphasisX = interacting
      ? Math.max(first, Math.min(focus.value, last))
      : (bigCenters[live.shown] ?? first);
    const emphasisTransform = `translate3d(${emphasisX.toFixed(2)}px, 0, 0) translateX(-50%)`;
    if (emphasisTransform !== writtenEmphasis) {
      emphasisEl.style.transform = writtenEmphasis = emphasisTransform;
    }

    if (!head.settled || !focus.settled) frameId = requestAnimationFrame(frame);
    else lastTime = 0;
  }

  const observer = new ResizeObserver(measure);
  observer.observe(ticksEl);
  const unsubscribe = stageProgress.subscribe(kick);
  measure();

  return {
    kick,
    measure,
    /** Jump the magnifier to x (the pointer has just entered). */
    snapFocus(x: number) {
      snapSpring(focus, x);
      kick();
    },
    /** Pointer clientX to x inside the ruler, clamped to it. */
    localX(clientX: number) {
      const box = ticksEl.getBoundingClientRect();
      return Math.max(0, Math.min(clientX - box.left, box.width));
    },
    nearestToX(x: number) {
      return nearestIndex(bigCenters, x);
    },
    nearestToProgress(progress: number) {
      return nearestIndex(bigCenters, trackX(track, progress));
    },
    progressAtX(x: number) {
      return trackProgress(track, x);
    },
    pulse(section: number) {
      const el = tickEls[BIG_TICK[section]];
      if (!el) return;
      el.removeAttribute("data-pulse");
      el.getBoundingClientRect(); // restart the animation
      el.setAttribute("data-pulse", "");
    },
    destroy() {
      cancelAnimationFrame(frameId);
      frameId = 0;
      observer.disconnect();
      unsubscribe();
    },
  };
}

// ---------------------------------------------------------------------------

export function ScrollIndicator() {
  const { isMobile, isContactStacked } = useLayoutFlags();
  const phase = useStore(introPhase);
  const active = useStore(stageProgress, (p) => p.step);
  const visible = isMobile
    ? phase >= HERO_INTRO_PHASE_MOBILE.scrollIndicator
    : phase >= HERO_INTRO_PHASE.uiGroup;
  // The same table the stage lands a tick click on.
  const reveal = sectionRevealTable(isMobile, isContactStacked);

  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [inside, setInside] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [lastEmphasized, setLastEmphasized] = useState(0);

  const emphasized = hovered ?? focused ?? (inside ? active : null);
  // Keep the last label while it fades out.
  if (emphasized !== null && emphasized !== lastEmphasized) setLastEmphasized(emphasized);
  const shown = emphasized ?? lastEmphasized;

  const ticksRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const emphasisRef = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const live = useRef<Live>({
    inside: false,
    dragging: false,
    pointerX: null,
    emphasized: null,
    shown: 0,
    reveal: SECTION_REVEAL_COMPLETE.desktop,
  });
  const press = useRef({
    down: false,
    moved: false,
    startX: 0,
    section: null as number | null,
    lastTick: -1,
  });

  useEffect(() => {
    const ticksEl = ticksRef.current;
    const headEl = headRef.current;
    const emphasisEl = emphasisRef.current;
    if (!ticksEl || !headEl || !emphasisEl) return;
    const instance = createEngine({ ticksEl, headEl, emphasisEl, live: live.current });
    engine.current = instance;
    return () => {
      instance.destroy();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    const l = live.current;
    l.inside = inside;
    l.dragging = dragging;
    l.emphasized = emphasized;
    l.shown = shown;
    if (l.reveal !== reveal) {
      l.reveal = reveal;
      engine.current?.measure();
    }
    engine.current?.kick();
  }, [inside, dragging, emphasized, shown, reveal]);

  // --- Pointer -------------------------------------------------------------

  const onPointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    const e = engine.current;
    if (!e) return;
    const x = e.localX(event.clientX);
    live.current.inside = true;
    live.current.pointerX = x;
    e.snapFocus(x);
    setInside(true);
    setHovered(e.nearestToX(x));
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const e = engine.current;
    if (!e) return;
    const x = e.localX(event.clientX);
    live.current.pointerX = x;
    e.kick();

    const p = press.current;
    if (!p.down) {
      if (live.current.inside) setHovered(e.nearestToX(x));
      return;
    }
    if (!p.moved && Math.abs(event.clientX - p.startX) > DRAG_THRESHOLD_PX) {
      p.moved = true;
      live.current.dragging = true;
      setDragging(true);
    }
    if (!p.moved) return;

    const progress = e.progressAtX(x);
    goToProgress(progress, { immediate: true });
    const tick = e.nearestToProgress(progress);
    setHovered(tick);
    if (tick !== p.lastTick) {
      p.lastTick = tick;
      e.pulse(tick);
      playSfx("hover");
    }
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const e = engine.current;
    if (!e || event.button !== 0) return;
    const tick = (event.target as HTMLElement).closest<HTMLElement>("[data-section-index]");
    const p = press.current;
    p.down = true;
    p.moved = false;
    p.startX = event.clientX;
    p.section = tick ? Number(tick.dataset.sectionIndex) : null;
    p.lastTick = e.nearestToProgress(stageProgress.get().global);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const release = (event: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    p.down = false;
    p.moved = false;
    p.section = null;
    live.current.dragging = false;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const e = engine.current;
    const p = press.current;
    if (!e || !p.down) return;
    const wasDrag = p.moved;
    const target = p.section ?? e.nearestToProgress(e.progressAtX(e.localX(event.clientX)));
    release(event);
    if (!wasDrag) goToSection(target);
  };

  const onPointerLeave = () => {
    live.current.inside = false;
    live.current.pointerX = null;
    press.current.section = null;
    setInside(false);
    setHovered(null);
  };

  // --- Keyboard ------------------------------------------------------------

  // Mouse clicks are handled on release (so a drag is never a click); this
  // only answers keyboard activation, which reports detail 0.
  const onTickClick = (event: MouseEvent<HTMLButtonElement>, section: number) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.detail === 0) goToSection(section);
  };

  const onTickFocus = (event: FocusEvent<HTMLButtonElement>, section: number) => {
    if (event.currentTarget.matches(":focus-visible")) setFocused(section);
  };

  // Roving focus across the ticks. Space and Enter stay with the button;
  // they are kept from the stage, which would read Space as "next section".
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const tick = (event.target as HTMLElement).closest<HTMLElement>("[data-section-index]");
    if (!tick) return;
    const current = Number(tick.dataset.sectionIndex);
    let next: number;
    switch (event.key) {
      case "ArrowLeft":
        next = Math.max(0, current - 1);
        break;
      case "ArrowRight":
        next = Math.min(SECTION_COUNT - 1, current + 1);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = SECTION_COUNT - 1;
        break;
      case " ":
      case "Enter":
        event.stopPropagation();
        return;
      default:
        return;
    }
    event.preventDefault();
    event.stopPropagation();
    ticksRef.current?.querySelector<HTMLElement>(`[data-section-index="${next}"]`)?.focus();
  };

  const tabStop = focused ?? active;

  return (
    <div
      className={clsx(styles.root, visible && styles.visible, emphasized !== null && styles.hovered)}
      inert={!visible}
    >
      <div
        className={clsx(styles.wrap, dragging && styles.dragging, inside && styles.interacting)}
        role="toolbar"
        aria-label="Sections"
        data-cursor-hide
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={release}
        onKeyDown={onKeyDown}
      >
        <div ref={ticksRef} className={styles.ticks}>
          <div
            ref={emphasisRef}
            className={clsx(styles.emphasis, emphasized !== null && styles.emphasisVisible)}
            aria-hidden="true"
          >
            <div className={styles.beam} />
            <div className={styles.label}>{SECTIONS[shown]?.indicatorLabel}</div>
          </div>

          {TICKS.map((tick, i) =>
            tick.big ? (
              <button
                key={i}
                type="button"
                data-tick=""
                className={clsx(
                  styles.tick,
                  styles.big,
                  tick.section === 0 && styles.first,
                  tick.section === SECTION_COUNT - 1 && styles.last,
                  tick.section === active && styles.isActive,
                  tick.section === emphasized && styles.isHovered,
                )}
                data-section-index={tick.section}
                aria-label={SECTIONS[tick.section].indicatorLabel}
                aria-current={tick.section === active ? "true" : undefined}
                tabIndex={tick.section === tabStop ? 0 : -1}
                onClick={(event) => onTickClick(event, tick.section)}
                onFocus={(event) => onTickFocus(event, tick.section)}
                onBlur={() => setFocused(null)}
              >
                <span className={styles.line} />
              </button>
            ) : (
              <span
                key={i}
                data-tick=""
                className={clsx(styles.tick, styles.small)}
                aria-hidden="true"
              >
                <span className={styles.line} />
              </span>
            ),
          )}
        </div>

        <div ref={headRef} className={styles.head} aria-hidden="true">
          <PositionMark />
          <PositionMark flipped />
        </div>
      </div>
    </div>
  );
}

/** A flat cap with a fine needle; the lower one points up. */
function PositionMark({ flipped = false }: { flipped?: boolean }) {
  return (
    <svg
      className={clsx(styles.mark, flipped && styles.markFlipped)}
      viewBox="0 0 10 7"
      fill="currentColor"
      focusable="false"
    >
      <path d="M0 0h10v1.1L5.55 2 5 7l-.55-5L0 1.1z" />
    </svg>
  );
}
