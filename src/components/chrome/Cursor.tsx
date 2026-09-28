"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cursor, useStore } from "@/lib/stage/store";
import styles from "./Cursor.module.css";

// The custom cursor: an ink dot that trails a fine pointer, inverts what it
// passes over, grows over controls, and carries a short label. See
// docs/research/components/cursor.spec.md.
//
// DOM hooks other components can use:
//   data-cursor-label="Proceed"  label pinned beside the element; the dot hides
//   data-cursor-hide             the dot hides and the native cursor shows
//   data-cursor="grab"           grab / grabbing looks
// The `cursor` store's `label` rides under the dot, and `active` grows it.

/** Bursts sit just under the dot, labels just over it. Keep the menu below and the preloader above. */
export const CURSOR_Z_INDEX = 9990;

/** Window event asking the cursor to ring once around a point: `{ x, y }` in client pixels. */
export const CURSOR_PULSE_EVENT = "cursor:hover-anim";
export type CursorPulseDetail = { x: number; y: number };

export function pulseCursor(x: number, y: number) {
  window.dispatchEvent(new CustomEvent<CursorPulseDetail>(CURSOR_PULSE_EVENT, { detail: { x, y } }));
}

/** Ring once around the centre of an element, e.g. a button the pointer just entered. */
export function pulseCursorAround(element: Element) {
  const rect = element.getBoundingClientRect();
  pulseCursor(rect.left + rect.width / 2, rect.top + rect.height / 2);
}

const INTERACTIVE = "a[href], button:not(:disabled), [role='button']";
const FORM_FIELD = "input, textarea, select, [contenteditable='true']";
const HIDE = "[data-cursor-hide]";
const GRAB = "[data-cursor='grab']";
const LABELLED = "[data-cursor-label]";

// Follow smoothing per 60fps frame: looser at rest, tighter over controls.
const SMOOTHING = { rest: 0.32, pointer: 0.42 } as const;
const SNAP_PX = 0.08;
const FOLLOW_LABEL_DROP = 24;
const ANCHOR_GAP = 12;
// Past this share of the viewport, an anchored label goes on the left.
const ANCHOR_FLIP = 0.7;

type Side = "left" | "right";
type AnchoredLabel = { key: number; text: string; x: number; y: number; side: Side };

type Hover = {
  interactive: boolean;
  field: boolean;
  hide: boolean;
  grab: boolean;
  /** The pointer is over a layer stacked above the cursor, so the dot can't be seen. */
  covered: boolean;
  label: AnchoredLabel | null;
};

const IDLE: Hover = { interactive: false, field: false, hide: false, grab: false, covered: false, label: null };

type Burst = { id: number; x: number; y: number };

function mediaQuery(query: string) {
  return {
    subscribe(onChange: () => void) {
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    matches: () => window.matchMedia(query).matches,
  };
}

const finePointer = mediaQuery("(hover: hover) and (pointer: fine)");
const reducedMotion = mediaQuery("(prefers-reduced-motion: reduce)");
const falseOnServer = () => false;

// The element's box without its own translation, so a label doesn't follow a
// button that drifts toward the pointer.
function restingRect(element: Element): DOMRect {
  const rect = element.getBoundingClientRect();
  const transform = getComputedStyle(element).transform;
  if (!transform || transform === "none") return rect;
  const { m41, m42 } = new DOMMatrixReadOnly(transform);
  return new DOMRect(rect.left - m41, rect.top - m42, rect.width, rect.height);
}

function isCovered(element: Element | null): boolean {
  for (let node = element; node && node !== document.body; node = node.parentElement) {
    const z = Number.parseInt(getComputedStyle(node).zIndex, 10);
    if (z > CURSOR_Z_INDEX + 1) return true;
  }
  return false;
}

const sameHover = (a: Hover, b: Hover) =>
  a.interactive === b.interactive &&
  a.field === b.field &&
  a.hide === b.hide &&
  a.grab === b.grab &&
  a.covered === b.covered &&
  a.label === b.label;

export function Cursor() {
  const enabled = useSyncExternalStore(finePointer.subscribe, finePointer.matches, falseOnServer);
  // Touch and coarse pointers keep the native cursor and get nothing drawn.
  return enabled ? <CursorLayer /> : null;
}

function CursorLayer() {
  const store = useStore(cursor);
  const reduced = useSyncExternalStore(reducedMotion.subscribe, reducedMotion.matches, falseOnServer);
  const [hover, setHover] = useState<Hover>(IDLE);
  const [present, setPresent] = useState(false);
  const [grabbing, setGrabbing] = useState(false);
  const [ripples, setRipples] = useState<Burst[]>([]);
  const [pulses, setPulses] = useState<Burst[]>([]);

  const dotRef = useRef<HTMLDivElement>(null);
  const followRef = useRef<HTMLDivElement>(null);
  // What the frame loop and the listeners need from the latest render.
  const live = useRef({ reduced, pointer: false });

  const storeLabel = store.label?.trim() || null;
  const pointerState = hover.interactive || hover.label !== null || storeLabel !== null || store.active;
  const dotHidden = !present || hover.covered || hover.field || hover.hide || hover.label !== null;
  const labelsBlocked = hover.hide || hover.covered || grabbing;
  const anchored = labelsBlocked ? null : hover.label;
  const following = labelsBlocked || anchored || !present ? null : storeLabel;

  useEffect(() => {
    live.current.reduced = reduced;
    live.current.pointer = pointerState;
  }, [reduced, pointerState]);

  // The native cursor is hidden only while the dot stands in for it.
  const nativeHidden = !dotHidden;
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle(styles.nativeHidden, nativeHidden);
    return () => root.classList.remove(styles.nativeHidden);
  }, [nativeHidden]);

  useEffect(() => {
    const target = { x: 0, y: 0 };
    const drawn = { x: 0, y: 0 };
    let hasPosition = false;
    let inside = false;
    let frame = 0;
    let lastTime = 0;
    let burstId = 0;
    let labelKey = 0;
    let labelOwner: Element | null = null;
    let current = IDLE;

    const place = () => {
      const dot = dotRef.current;
      const follow = followRef.current;
      if (dot) dot.style.transform = `translate3d(${drawn.x}px, ${drawn.y}px, 0)`;
      if (follow) follow.style.transform = `translate3d(${drawn.x}px, ${drawn.y + FOLLOW_LABEL_DROP}px, 0)`;
    };

    const tick = (now: number) => {
      frame = 0;
      const dt = lastTime ? Math.min(40, now - lastTime) : 16.67;
      lastTime = now;
      const base = live.current.pointer ? SMOOTHING.pointer : SMOOTHING.rest;
      const k = live.current.reduced ? 1 : 1 - (1 - base) ** Math.min(2.4, dt / 16.67);
      drawn.x += (target.x - drawn.x) * k;
      drawn.y += (target.y - drawn.y) * k;
      if (Math.abs(target.x - drawn.x) < SNAP_PX) drawn.x = target.x;
      if (Math.abs(target.y - drawn.y) < SNAP_PX) drawn.y = target.y;
      place();
      if (drawn.x !== target.x || drawn.y !== target.y) frame = requestAnimationFrame(tick);
      else lastTime = 0;
    };

    const follow = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const anchorFor = (owner: HTMLElement, text: string): AnchoredLabel => {
      if (owner === labelOwner && current.label?.text === text) return current.label;
      labelOwner = owner;
      const rect = restingRect(owner);
      const side: Side = rect.right > window.innerWidth * ANCHOR_FLIP ? "left" : "right";
      return {
        key: ++labelKey,
        text,
        x: side === "left" ? rect.left - ANCHOR_GAP : rect.right + ANCHOR_GAP,
        y: rect.top + rect.height / 2,
        side,
      };
    };

    const read = (element: Element | null) => {
      const owner = element?.closest<HTMLElement>(LABELLED) ?? null;
      const text = owner?.dataset.cursorLabel?.trim();
      if (!owner || !text) labelOwner = null;
      const next: Hover = {
        interactive: Boolean(element?.closest(INTERACTIVE)),
        field: Boolean(element?.closest(FORM_FIELD)),
        hide: Boolean(element?.closest(HIDE)),
        grab: Boolean(element?.closest(GRAB)),
        covered: isCovered(element),
        label: owner && text ? anchorFor(owner, text) : null,
      };
      if (!sameHover(current, next)) {
        current = next;
        setHover(next);
      }
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      target.x = event.clientX;
      target.y = event.clientY;
      if (!hasPosition) {
        hasPosition = true;
        drawn.x = target.x;
        drawn.y = target.y;
        place();
      }
      if (!inside) {
        inside = true;
        setPresent(true);
        read(event.target instanceof Element ? event.target : null);
      }
      follow();
    };

    const onOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      read(event.target instanceof Element ? event.target : null);
    };

    // Leaving the window (or entering an iframe) hands the pointer back.
    const onOut = (event: PointerEvent) => {
      if (event.pointerType === "touch" || event.relatedTarget) return;
      inside = false;
      setPresent(false);
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      if (event.target instanceof Element && event.target.closest(GRAB)) setGrabbing(true);
    };

    const onRelease = () => setGrabbing(false);

    const onClick = (event: MouseEvent) => {
      // Keyboard activation has no pointer position.
      if (event.detail === 0) return;
      const { clientX: x, clientY: y } = event;
      if (!live.current.reduced) {
        const id = ++burstId;
        setRipples((list) => [...list, { id, x, y }]);
      }
      // Clicks often change what is under the pointer.
      requestAnimationFrame(() => read(document.elementFromPoint(x, y)));
    };

    const onPulse = (event: Event) => {
      if (live.current.reduced) return;
      const detail = (event as CustomEvent<Partial<CursorPulseDetail> | null>).detail;
      const id = ++burstId;
      const x = detail?.x ?? drawn.x;
      const y = detail?.y ?? drawn.y;
      setPulses((list) => [...list, { id, x, y }]);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerover", onOver, { passive: true });
    window.addEventListener("pointerout", onOut, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onRelease, { passive: true });
    window.addEventListener("pointercancel", onRelease, { passive: true });
    window.addEventListener("blur", onRelease);
    window.addEventListener("click", onClick, { passive: true });
    window.addEventListener(CURSOR_PULSE_EVENT, onPulse);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerover", onOver);
      window.removeEventListener("pointerout", onOut);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onRelease);
      window.removeEventListener("pointercancel", onRelease);
      window.removeEventListener("blur", onRelease);
      window.removeEventListener("click", onClick);
      window.removeEventListener(CURSOR_PULSE_EVENT, onPulse);
    };
  }, []);

  const dotClass = [
    styles.dot,
    pointerState ? styles.pointer : "",
    hover.grab && !pointerState && !grabbing ? styles.grab : "",
    grabbing ? styles.grabbing : "",
    dotHidden ? styles.hidden : "",
  ].join(" ");

  const dropRipple = (id: number) => setRipples((list) => list.filter((b) => b.id !== id));
  const dropPulse = (id: number) => setPulses((list) => list.filter((b) => b.id !== id));

  return (
    <>
      {pulses.map(({ id, x, y }) => (
        <div
          key={`pulse-${id}`}
          className={styles.burst}
          style={{ transform: `translate3d(${x}px, ${y}px, 0)`, zIndex: CURSOR_Z_INDEX - 1 }}
          onAnimationEnd={() => dropPulse(id)}
          aria-hidden="true"
        >
          <span className={styles.pulse} />
        </div>
      ))}
      {ripples.map(({ id, x, y }) => (
        <div
          key={`ripple-${id}`}
          className={styles.burst}
          style={{ transform: `translate3d(${x}px, ${y}px, 0)`, zIndex: CURSOR_Z_INDEX - 1 }}
          onAnimationEnd={() => dropRipple(id)}
          aria-hidden="true"
        >
          <span className={styles.ripple} />
        </div>
      ))}
      <div ref={dotRef} className={dotClass} style={{ zIndex: CURSOR_Z_INDEX }} aria-hidden="true">
        <span className={styles.size}>
          <span className={styles.core} />
        </span>
      </div>
      <div ref={followRef} className={styles.follow} style={{ zIndex: CURSOR_Z_INDEX + 1 }} aria-hidden="true">
        {following ? (
          <p key={following} className={`${styles.label} ${styles.labelFollow}`}>
            {following}
          </p>
        ) : null}
      </div>
      {anchored ? (
        <p
          key={anchored.key}
          className={`${styles.label} ${anchored.side === "left" ? styles.labelLeft : styles.labelRight}`}
          style={{ left: anchored.x, top: anchored.y, zIndex: CURSOR_Z_INDEX + 1 }}
          aria-hidden="true"
        >
          {anchored.text}
        </p>
      ) : null}
    </>
  );
}
