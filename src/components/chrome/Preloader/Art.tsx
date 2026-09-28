import { useId } from "react";
import styles from "./Art.module.css";

// The two concentric circles behind the gate: short arcs of a large outer
// circle to the left and right, the sides of an inner circle, and a crosshair
// on each. The arcs grow out of the centre while the crosshairs orbit into
// place; leaving plays it back. Purely decorative.

const BOX = 1000;
const CENTRE = BOX / 2;

type ArcSpec = {
  key: string;
  radius: number;
  /** Degrees, clockwise from 12 o'clock. */
  from: number;
  to: number;
  stroke: number;
  crosshairAt: number;
  ringClass: string;
  orbitClass: string;
};

const ARCS: ArcSpec[] = [
  { key: "outer-right", radius: 500, from: 58, to: 122, stroke: 1.45, crosshairAt: 90, ringClass: styles.outerRight, orbitClass: styles.orbitOuter },
  { key: "outer-left", radius: 500, from: 238, to: 302, stroke: 1.45, crosshairAt: 270, ringClass: styles.outerLeft, orbitClass: styles.orbitOuter },
  { key: "inner-right", radius: 250, from: 20, to: 160, stroke: 0.73, crosshairAt: 0, ringClass: styles.inner, orbitClass: styles.orbitInner },
  { key: "inner-left", radius: 250, from: 200, to: 340, stroke: 0.73, crosshairAt: 180, ringClass: styles.inner, orbitClass: styles.orbitInner },
];

function pointOn(radius: number, degrees: number) {
  const a = (degrees * Math.PI) / 180;
  return { x: CENTRE + radius * Math.sin(a), y: CENTRE - radius * Math.cos(a) };
}

const fmt = (n: number) => Number(n.toFixed(2));

function Crosshair({ x, y }: { x: number; y: number }) {
  const arm = 6.5;
  const bar = 1.04;
  const gem = 3;
  return (
    <g transform={`translate(${fmt(x)} ${fmt(y)})`} fill="currentColor">
      <rect x={-bar / 2} y={-arm} width={bar} height={arm * 2} />
      <rect x={-arm} y={-bar / 2} width={arm * 2} height={bar} />
      <rect x={-gem / 2} y={-gem / 2} width={gem} height={gem} transform="rotate(45)" />
    </g>
  );
}

function ArcLayer({ arc }: { arc: ArcSpec }) {
  const gradientId = useId();
  const start = pointOn(arc.radius, arc.from);
  const end = pointOn(arc.radius, arc.to);
  const sweep = (((arc.to - arc.from) % 360) + 360) % 360;
  const path = `M ${fmt(start.x)} ${fmt(start.y)} A ${arc.radius} ${arc.radius} 0 ${sweep > 180 ? 1 : 0} 1 ${fmt(end.x)} ${fmt(end.y)}`;
  const mark = pointOn(arc.radius, arc.crosshairAt);

  return (
    <div className={`${styles.ring} ${arc.ringClass}`}>
      <svg className={styles.layer} viewBox={`0 0 ${BOX} ${BOX}`} fill="none">
        <defs>
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1={fmt(start.x)}
            y1={fmt(start.y)}
            x2={fmt(end.x)}
            y2={fmt(end.y)}
          >
            <stop offset="0" stopColor="currentColor" stopOpacity="0" />
            <stop offset="0.5" stopColor="currentColor" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <g className={styles.stroke}>
          <path d={path} stroke={`url(#${gradientId})`} strokeWidth={arc.stroke} strokeLinecap="round" />
        </g>
      </svg>
      <div className={`${styles.orbit} ${arc.orbitClass}`}>
        <svg className={styles.layer} viewBox={`0 0 ${BOX} ${BOX}`} fill="none">
          <Crosshair x={mark.x} y={mark.y} />
        </svg>
      </div>
    </div>
  );
}

export function Art({ leaving }: { leaving: boolean }) {
  return (
    <div className={styles.art} data-leaving={leaving || undefined} aria-hidden="true">
      <div className={styles.frame}>
        {ARCS.map((arc) => (
          <ArcLayer key={arc.key} arc={arc} />
        ))}
      </div>
    </div>
  );
}
