"use client";

import { useEffect, useId, useRef, useSyncExternalStore, type Ref } from "react";
import { stageProgress } from "@/lib/stage/store";
import { useLayoutFlags } from "@/lib/stage/useLayoutFlags";
import { circleFrameAt } from "./circles/timeline";
import styles from "./CircleBackground.module.css";

// Concentric rings behind the opening sections: three rings with crosshairs
// through the problem section, one ring flanked by two small circles through
// reads, then a sweep out past the viewport edges. See
// docs/research/components/circle-background.spec.md.

// The reference skips the overlay on handheld devices as well as on phone-width
// windows: a mobile user agent, or a coarse pointer on a short screen.
const HANDHELD_UA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone/i;

function isHandheld(): boolean {
  if (HANDHELD_UA.test(navigator.userAgent)) return true;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return coarse && Math.min(window.innerWidth, window.innerHeight) <= 1024;
}

function subscribeHandheld(onChange: () => void) {
  const coarse = window.matchMedia("(pointer: coarse)");
  coarse.addEventListener("change", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    coarse.removeEventListener("change", onChange);
    window.removeEventListener("resize", onChange);
  };
}

// Nothing is drawn during server render; the client decides.
const handheldOnServer = () => true;

export function CircleBackground() {
  const { isPhone } = useLayoutFlags();
  const handheld = useSyncExternalStore(subscribeHandheld, isHandheld, handheldOnServer);
  if (isPhone || handheld) return null;
  return <CircleLayer />;
}

// The vertical fade every ring is stroked with: clear at the top and bottom,
// full on the horizontal centre line. The shoulders are lifted so a single 1px
// stroke reads like the reference's paired strokes.
const FADE_STOPS: ReadonlyArray<readonly [offset: number, opacity: number]> = [
  [0, 0],
  [0.125, 0.44],
  [0.25, 0.75],
  [0.375, 0.94],
  [0.5, 1],
  [0.625, 0.94],
  [0.75, 0.75],
  [0.875, 0.44],
  [1, 0],
];

function Fade({ id }: { id: string }) {
  return (
    <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="50" y1="20" x2="50" y2="80">
      {FADE_STOPS.map(([offset, opacity]) => (
        <stop key={offset} offset={offset} stopOpacity={opacity} style={{ stopColor: "var(--ink)" }} />
      ))}
    </linearGradient>
  );
}

// Rings live in a 100-unit box; the stroke stays 1px at any size.
const RADIUS = 49.9;

function Ring({ className }: { className: string }) {
  const fade = useId();
  return (
    <svg className={`${styles.ring} ${className}`} viewBox="0 0 100 100" fill="none" focusable="false">
      <defs>
        <Fade id={fade} />
      </defs>
      <circle cx="50" cy="50" r={RADIUS} stroke={`url(#${fade})`} strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// A side circle strokes outwards from the two points on the centre line, up and
// down at once, so it is drawn as four quarter arcs that each start there.
// Dashes and non-scaling strokes don't mix reliably across browsers, so its 1px
// stroke width is set in user units from the circle's live size instead.
const QUARTERS = [
  `M${50 - RADIUS} 50A${RADIUS} ${RADIUS} 0 0 1 50 ${50 - RADIUS}`,
  `M${50 - RADIUS} 50A${RADIUS} ${RADIUS} 0 0 0 50 ${50 + RADIUS}`,
  `M${50 + RADIUS} 50A${RADIUS} ${RADIUS} 0 0 0 50 ${50 - RADIUS}`,
  `M${50 + RADIUS} 50A${RADIUS} ${RADIUS} 0 0 1 50 ${50 + RADIUS}`,
];

type SideRingProps = {
  className: string;
  boxRef: Ref<HTMLDivElement>;
  strokeRef: Ref<SVGGElement>;
};

function SideRing({ className, boxRef, strokeRef }: SideRingProps) {
  const fade = useId();
  return (
    <div ref={boxRef} className={`${styles.side} ${className}`}>
      <svg className={styles.sideSvg} viewBox="0 0 100 100" fill="none" focusable="false">
        <defs>
          <Fade id={fade} />
        </defs>
        <g ref={strokeRef} stroke={`url(#${fade})`} strokeWidth="0.3" strokeDasharray="1 1" strokeDashoffset="1">
          {QUARTERS.map((d) => (
            <path key={d} d={d} pathLength={1} />
          ))}
        </g>
      </svg>
    </div>
  );
}

// Crosshair: a thin plus with a small diamond at its heart.
function Crosshair({ className }: { className: string }) {
  return (
    <span className={`${styles.crosshair} ${className}`}>
      <svg viewBox="0 0 24 24" fill="currentColor" focusable="false">
        <path d="M11.2 0h1.6v24h-1.6zM0 11.2h24v1.6H0z" />
        <path d="M12 8.2 15.8 12 12 15.8 8.2 12z" />
      </svg>
    </span>
  );
}

function CircleLayer() {
  const root = useRef<HTMLDivElement>(null);
  const item = useRef<HTMLDivElement>(null);
  const outer = useRef<HTMLDivElement>(null);
  const middle = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const lineLeft = useRef<HTMLSpanElement>(null);
  const lineRight = useRef<HTMLSpanElement>(null);
  const sideLeft = useRef<HTMLDivElement>(null);
  const sideRight = useRef<HTMLDivElement>(null);
  const strokeLeft = useRef<SVGGElement>(null);
  const strokeRight = useRef<SVGGElement>(null);

  // Scroll moves this every frame, so it is written straight to the DOM from
  // the store rather than through React renders.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let shown = false;

    const apply = () => {
      const layer = root.current;
      if (!layer) return;
      const { step, value } = stageProgress.get();
      const frame = circleFrameAt(step, value, reduced.matches);

      if (frame.visible !== shown) {
        shown = frame.visible;
        layer.style.visibility = shown ? "visible" : "hidden";
      }
      if (!frame.visible) return;

      item.current?.style.setProperty("width", `${frame.width.toFixed(3)}%`);

      const rings = [
        [outer.current, frame.outer],
        [middle.current, frame.middle],
        [inner.current, frame.inner],
      ] as const;
      for (const [el, state] of rings) {
        if (!el) continue;
        el.style.opacity = state.opacity.toFixed(4);
        el.style.setProperty("--ring-scale", state.scale.toFixed(4));
      }

      const lines = frame.lines.toFixed(4);
      for (const line of [lineLeft.current, lineRight.current]) {
        if (!line) continue;
        line.style.opacity = lines;
        line.style.transform = `scale3d(${lines}, 1, 1)`;
      }

      const sideOpacity = frame.side.opacity.toFixed(4);
      for (const side of [sideLeft.current, sideRight.current]) {
        if (side) side.style.opacity = sideOpacity;
      }
      // Dash offset and width are inherited by the arcs; each arc has pathLength 1.
      const offset = (1 - frame.side.draw).toFixed(4);
      const sidePx = (window.innerWidth * frame.width) / 200;
      const strokeWidth = (100 / Math.max(sidePx, 1)).toFixed(4);
      for (const stroke of [strokeLeft.current, strokeRight.current]) {
        stroke?.setAttribute("stroke-dashoffset", offset);
        stroke?.setAttribute("stroke-width", strokeWidth);
      }
    };

    apply();
    const unsubscribe = stageProgress.subscribe(apply);
    reduced.addEventListener("change", apply);
    window.addEventListener("resize", apply);
    return () => {
      unsubscribe();
      reduced.removeEventListener("change", apply);
      window.removeEventListener("resize", apply);
    };
  }, []);

  return (
    <div ref={root} className={styles.root} aria-hidden="true">
      <div ref={item} className={styles.item}>
        <div ref={outer} className={styles.outer}>
          <Ring className={styles.ringOuter} />
          <Crosshair className={styles.crosshairLeft} />
          <Crosshair className={styles.crosshairRight} />
          <span ref={lineLeft} className={`${styles.line} ${styles.lineLeft}`} />
          <span ref={lineRight} className={`${styles.line} ${styles.lineRight}`} />
        </div>
        <div ref={middle} className={`${styles.scaled} ${styles.middle}`}>
          <Ring className={styles.ringMiddle} />
        </div>
        <div ref={inner} className={`${styles.scaled} ${styles.inner}`}>
          <Ring className={styles.ringInner} />
        </div>
        <SideRing className={styles.sideLeft} boxRef={sideLeft} strokeRef={strokeLeft} />
        <SideRing className={styles.sideRight} boxRef={sideRight} strokeRef={strokeRight} />
      </div>
    </div>
  );
}
