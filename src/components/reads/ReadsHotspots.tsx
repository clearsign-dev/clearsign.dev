"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type FocusEvent,
  type PointerEvent,
} from "react";
import { playSfx } from "@/lib/audio/sfx";
import { READS } from "@/lib/content";
import { EASE } from "@/lib/motion/easings";
import { clamp01, smoothstep } from "@/lib/motion/progress";
import { useEyeFollow } from "./useEyeFollow";
import styles from "./ReadsHotspots.module.css";

// Desktop: one "eye" hotspot in each side circle. Collapsed it is a white eye
// with "Hover to explore" beneath; hovering, focusing or pressing it tucks the
// eye away behind a cross and grows a glass panel, towards the centre of the
// screen, with the group's title, summary and list.

type Group = (typeof READS.groups)[number];
type Side = "left" | "right";
type OpenState = { index: number; pinned: boolean } | null;

// Interactive once its reveal is this far in; closes if it scrolls back below.
const REVEALED = 0.5;
const CLOSE_DELAY_MS = 140;
// Gap kept between an opened panel and the viewport edge.
const EDGE_MARGIN = 28;
// The panel sits 1rem beside the button (≥1440px) or 0.75rem below it.
const GAP_BESIDE_REM = 1;
const GAP_BELOW_REM = 0.75;
// Beside the button, the panel's first line is raised to the button's centre.
const RAISE_REM = 1.35;
const BELOW_QUERY = "(max-width: 1439px)";

// The reference's 820ms reveal (button 0–400ms, hint 420–820ms) laid on the
// hotspot's scroll beat.
const BUTTON_SPAN = 400 / 820;
const HINT_START = 420 / 820;

const phase = (progress: number, start: number, span: number) =>
  smoothstep(clamp01((progress - start) / span));

// Signed correction that pulls [min, max] inside [EDGE_MARGIN, size - EDGE_MARGIN].
function axisClamp(min: number, max: number, size: number): number {
  let delta = 0;
  const low = EDGE_MARGIN - min;
  const high = max - (size - EDGE_MARGIN);
  if (low > 0) delta += low;
  if (high > 0) delta -= high;
  return delta;
}

function EyeGlyph() {
  return (
    <svg viewBox="0 0 24 16" fill="currentColor" aria-hidden="true" focusable="false">
      <path
        fillRule="evenodd"
        d="M1 8C4.2 3.1 7.9 1 12 1s7.8 2.1 11 7c-3.2 4.9-6.9 7-11 7S4.2 12.9 1 8Zm11-4.6a4.6 4.6 0 1 0 0 9.2 4.6 4.6 0 0 0 0-9.2Z"
      />
      <circle cx="12" cy="8" r="2.4" />
    </svg>
  );
}

function CrossGlyph({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <path d="M10 0v20M0 10h20" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10 6.7 13.3 10 10 13.3 6.7 10Z" fill="currentColor" />
    </svg>
  );
}

type HotspotProps = {
  group: Group;
  index: number;
  side: Side;
  progress: number;
  expanded: boolean;
  registerRoot: (index: number, el: HTMLDivElement | null) => void;
  onEnter: (index: number) => void;
  onLeave: (index: number) => void;
  onFocusIn: (index: number) => void;
  onFocusOut: (index: number) => void;
  onToggle: (index: number) => void;
};

function Hotspot({
  group,
  index,
  side,
  progress,
  expanded,
  registerRoot,
  onEnter,
  onLeave,
  onFocusIn,
  onFocusOut,
  onToggle,
}: HotspotProps) {
  const buttonId = useId();
  const contentId = useId();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const eyeRef = useRef<HTMLSpanElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useEyeFollow(eyeRef);

  const setRoot = useCallback(
    (el: HTMLDivElement | null) => {
      rootRef.current = el;
      registerRoot(index, el);
    },
    [index, registerRoot],
  );

  // The panel animates between two measured boxes: the summary (collapsed)
  // and the full content (expanded). Measured into CSS variables, so a font
  // swap or a breakpoint change re-sizes it without a render.
  useEffect(() => {
    const desc = descRef.current;
    const summary = summaryRef.current;
    const inner = innerRef.current;
    if (!desc || !summary || !inner) return;
    const measure = () => {
      desc.style.setProperty("--desc-w-collapsed", `${summary.offsetWidth}px`);
      desc.style.setProperty("--desc-h-collapsed", `${summary.offsetHeight}px`);
      desc.style.setProperty("--desc-w-expanded", `${inner.offsetWidth}px`);
      desc.style.setProperty("--desc-h-expanded", `${inner.offsetHeight}px`);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(summary);
    observer.observe(inner);
    return () => observer.disconnect();
  }, []);

  // An opened panel is pulled back inside the viewport, from where it will
  // land at full size (not from its current, still-growing box).
  const place = useCallback(() => {
    const root = rootRef.current;
    const desc = descRef.current;
    const inner = innerRef.current;
    if (!root || !desc || !inner) return;
    const box = root.getBoundingClientRect();
    if (box.width === 0) return;
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const width = inner.offsetWidth;
    const height = inner.offsetHeight;
    let left: number;
    let top: number;
    if (window.matchMedia(BELOW_QUERY).matches) {
      left = box.left + box.width / 2 - width / 2;
      top = box.bottom + GAP_BELOW_REM * rem;
    } else {
      left =
        side === "right"
          ? box.right + GAP_BESIDE_REM * rem
          : box.left - GAP_BESIDE_REM * rem - width;
      top = box.top + box.height / 2 - RAISE_REM * rem;
    }
    const dx = Math.round(axisClamp(left, left + width, window.innerWidth));
    const dy = Math.round(axisClamp(top, top + height, window.innerHeight));
    desc.style.setProperty("--magnet-x", `${dx}px`);
    desc.style.setProperty("--magnet-y", `${dy}px`);
  }, [side]);

  useLayoutEffect(() => {
    if (!expanded) return;
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [expanded, place]);

  const buttonProgress = phase(progress, 0, BUTTON_SPAN);
  const hintProgress = phase(progress, HINT_START, 1 - HINT_START);
  const interactive = progress > REVEALED;

  const handleEnter = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") onEnter(index);
  };
  const handleLeave = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "touch") onLeave(index);
  };
  const handleFocusOut = (event: FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget as Node | null;
    if (!next || !event.currentTarget.contains(next)) onFocusOut(index);
  };

  return (
    <div
      ref={setRoot}
      className={[
        styles.hotspot,
        side === "right" ? styles.opensRight : styles.opensLeft,
        expanded ? styles.open : "",
      ].join(" ")}
      style={{
        pointerEvents: interactive ? "auto" : "none",
        visibility: progress > 0.001 ? "visible" : "hidden",
      }}
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
      onFocus={() => onFocusIn(index)}
      onBlur={handleFocusOut}
    >
      <div
        className={styles.buttonReveal}
        style={{
          opacity: buttonProgress,
          transform: `translate3d(0, ${(1 - buttonProgress) * 20}%, 0) scale(${buttonProgress})`,
        }}
      >
        <button
          id={buttonId}
          type="button"
          className={styles.button}
          aria-label={group.title}
          aria-expanded={expanded}
          aria-controls={contentId}
          tabIndex={interactive ? 0 : -1}
          data-cursor-hide=""
          onClick={() => onToggle(index)}
        >
          <span ref={eyeRef} className={styles.eye} aria-hidden="true">
            <EyeGlyph />
          </span>
          <CrossGlyph className={styles.cross} />
        </button>
      </div>

      <div
        className={styles.hintReveal}
        style={{
          opacity: hintProgress,
          transform: `translate3d(0, ${(1 - hintProgress) * 18}px, 0)`,
        }}
        aria-hidden="true"
      >
        <span className={styles.hint}>{READS.hotspotHint}</span>
      </div>

      <div ref={descRef} className={styles.desc}>
        <div ref={summaryRef} className={styles.summary} aria-hidden="true">
          <p className={styles.title}>{group.title}</p>
          <p className={styles.summaryText}>{group.summary}</p>
        </div>
        <div
          id={contentId}
          className={styles.content}
          role="region"
          aria-labelledby={buttonId}
          aria-hidden={!expanded}
        >
          <div className={styles.mask}>
            <div ref={innerRef} className={styles.inner}>
              <h3 className={styles.title}>{group.title}</h3>
              <p className={styles.summaryText}>{group.summary}</p>
              <ul className={styles.items}>
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Side-circle centres and diameter, in % of the viewport width. */
export type SideCircles = { left: number; right: number; diameter: number };

type ReadsHotspotsProps = {
  /** Reveal progress per group, 0..1. */
  progress: readonly number[];
  /** Where the circle background's side circles are; the hotspots ride them. */
  circles: SideCircles;
};

export function ReadsHotspots({ progress, circles }: ReadsHotspotsProps) {
  const [open, setOpen] = useState<OpenState>(null);
  const roots = useRef<(HTMLDivElement | null)[]>([]);
  const hovered = useRef<number | null>(null);
  // A hotspot closed by Escape or a second press stays closed until the
  // pointer leaves it or focus moves on, so hover and focus do not reopen it.
  const suppressed = useRef(new Set<number>());
  const closeTimer = useRef(0);

  // A hotspot that scrolls out of reach closes, rather than reopening by
  // itself when it comes back.
  const revealed = READS.groups.map((_, i) => (progress[i] ?? 0) > REVEALED);
  const revealedKey = revealed.join();
  const [seenKey, setSeenKey] = useState(revealedKey);
  if (seenKey !== revealedKey) {
    setSeenKey(revealedKey);
    if (open && !revealed[open.index]) setOpen(null);
  }

  const registerRoot = useCallback((index: number, el: HTMLDivElement | null) => {
    roots.current[index] = el;
  }, []);

  const cancelClose = () => window.clearTimeout(closeTimer.current);

  const openAt = (index: number) =>
    setOpen((prev) => (prev?.index === index ? prev : { index, pinned: false }));

  const closeAt = (index: number, force: boolean) =>
    setOpen((prev) => (prev && prev.index === index && (force || !prev.pinned) ? null : prev));

  const handleEnter = (index: number) => {
    hovered.current = index;
    cancelClose();
    if (suppressed.current.has(index)) return;
    if (open?.index !== index) playSfx("hover");
    openAt(index);
  };

  const handleLeave = (index: number) => {
    if (hovered.current === index) hovered.current = null;
    suppressed.current.delete(index);
    cancelClose();
    closeTimer.current = window.setTimeout(() => closeAt(index, false), CLOSE_DELAY_MS);
  };

  const handleFocusIn = (index: number) => {
    if (suppressed.current.has(index)) return;
    cancelClose();
    openAt(index);
  };

  const handleFocusOut = (index: number) => {
    suppressed.current.delete(index);
    if (hovered.current === index) return;
    closeAt(index, true);
  };

  const handleToggle = (index: number) => {
    playSfx("click");
    cancelClose();
    if (open?.index === index && open.pinned) {
      suppressed.current.add(index);
      setOpen(null);
    } else {
      suppressed.current.delete(index);
      setOpen({ index, pinned: true });
    }
  };

  // While one is open: Escape closes it, and so does pressing anywhere else.
  useEffect(() => {
    if (!open) return;
    const { index } = open;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      suppressed.current.add(index);
      setOpen(null);
    };
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node | null;
      if (target && roots.current.some((root) => root?.contains(target))) return;
      setOpen(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  useEffect(() => {
    const timer = closeTimer;
    return () => window.clearTimeout(timer.current);
  }, []);

  const active = open && revealed[open.index] ? open.index : -1;

  return (
    <div
      className={styles.layer}
      style={
        {
          "--ease-back-out": EASE.backOut,
          "--ease-back-in": EASE.backIn,
          "--ease-sine": EASE.sineInOut,
          "--ease-out-quart": EASE.outQuart,
          "--hotspot-left": `${circles.left}%`,
          "--hotspot-right": `${circles.right}%`,
          "--side-diameter": `${circles.diameter}vw`,
        } as CSSProperties
      }
    >
      {READS.groups.map((group, i) => (
        <Hotspot
          key={group.title}
          group={group}
          index={i}
          // The left hotspot opens to its right, the right one to its left:
          // both towards the centre.
          side={i === 0 ? "right" : "left"}
          progress={progress[i] ?? 0}
          expanded={active === i}
          registerRoot={registerRoot}
          onEnter={handleEnter}
          onLeave={handleLeave}
          onFocusIn={handleFocusIn}
          onFocusOut={handleFocusOut}
          onToggle={handleToggle}
        />
      ))}
    </div>
  );
}
