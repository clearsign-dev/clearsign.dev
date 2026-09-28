"use client";

import { useId, type ReactNode } from "react";
import { MARK_PATHS } from "@/components/brand/Mark";
import styles from "./Aperture.module.css";

// The middle "0": ClearSign's aperture, the C from the mark, standing in the
// dark with a light inside it. The ring is made of the same dark glass as the
// 4s; its inner edge catches the light, the disc inside glows, and light leaks
// out through the C's opening on the right. The go-home dot sits at its centre.
//
// Geometry is the mark's own 1024 box: the arc is centred on (512, 512) with
// radius 292 and a 132 stroke, so the ring runs from r = 226 to r = 358 and the
// opening spans ±54° about the +x axis.

const CENTRE = 512;
const INNER = 226;
const OUTER = 358;

// A wedge from the centre out through the opening, for the escaping light.
const ESCAPE = (() => {
  const reach = 560;
  const spread = (62 * Math.PI) / 180;
  const pt = (a: number) =>
    `${(CENTRE + Math.cos(a) * reach).toFixed(1)} ${(CENTRE + Math.sin(a) * reach).toFixed(1)}`;
  return `M ${CENTRE} ${CENTRE} L ${pt(-spread)} L ${pt(-spread / 2)} L ${pt(0)} L ${pt(spread / 2)} L ${pt(spread)} Z`;
})();

type ApertureProps = {
  hover?: boolean;
  className?: string;
  children?: ReactNode;
};

export function Aperture({ hover = false, className = "", children }: ApertureProps) {
  const uid = `ap${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const id = (name: string) => `${uid}-${name}`;
  const edge = INNER / OUTER;

  return (
    <span className={`${styles.aperture} ${className}`} data-hover={hover || undefined}>
      <span className={styles.bloom} aria-hidden="true" />
      {/* The light: the glowing disc and what leaks out of the opening. Its own
          layer, so its flicker is a composited opacity change, not a repaint. */}
      <svg className={styles.light} viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
        <defs>
          <radialGradient id={id("core")} cx={CENTRE} cy={CENTRE} r={INNER + 14} gradientUnits="userSpaceOnUse">
            <stop offset="0" style={{ stopColor: "var(--ink)", stopOpacity: 1 }} />
            <stop offset="0.42" style={{ stopColor: "var(--ink)", stopOpacity: 0.92 }} />
            <stop offset="0.78" style={{ stopColor: "var(--accent)", stopOpacity: 0.72 }} />
            <stop offset="1" style={{ stopColor: "var(--accent-deep)", stopOpacity: 0.55 }} />
          </radialGradient>
          <radialGradient id={id("escape")} cx={CENTRE} cy={CENTRE} r="560" gradientUnits="userSpaceOnUse">
            <stop offset="0" style={{ stopColor: "var(--ink)", stopOpacity: 0.85 }} />
            <stop offset="0.45" style={{ stopColor: "var(--accent)", stopOpacity: 0.32 }} />
            <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
          </radialGradient>
          <filter id={id("soft")} x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="30" />
          </filter>
        </defs>
        <path d={ESCAPE} fill={`url(#${id("escape")})`} filter={`url(#${id("soft")})`} />
        <circle cx={CENTRE} cy={CENTRE} r={INNER + 10} fill={`url(#${id("core")})`} />
      </svg>

      {/* The C itself, in the 4s' dark glass, its inner edge catching the light. */}
      <svg className={styles.ring} viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={id("body")} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style={{ stopColor: "var(--grey-400)" }} />
            <stop offset="0.3" style={{ stopColor: "var(--dark)" }} />
            <stop offset="0.55" style={{ stopColor: "var(--grey-400)" }} />
            <stop offset="0.8" style={{ stopColor: "var(--ground)" }} />
            <stop offset="1" style={{ stopColor: "var(--grey-400)" }} />
          </linearGradient>
          <radialGradient id={id("rim")} cx={CENTRE} cy={CENTRE} r={OUTER} gradientUnits="userSpaceOnUse">
            <stop offset={edge - 0.01} style={{ stopColor: "var(--ink)", stopOpacity: 0 }} />
            <stop offset={edge + 0.005} style={{ stopColor: "var(--ink)", stopOpacity: 0.62 }} />
            <stop offset={edge + 0.07} style={{ stopColor: "var(--accent)", stopOpacity: 0.3 }} />
            <stop offset={edge + 0.18} style={{ stopColor: "var(--accent)", stopOpacity: 0 }} />
            <stop offset="0.965" style={{ stopColor: "var(--ink)", stopOpacity: 0 }} />
            <stop offset="1" style={{ stopColor: "var(--ink)", stopOpacity: 0.2 }} />
          </radialGradient>
        </defs>
        <path d={MARK_PATHS.aperture} fill="none" stroke={`url(#${id("body")})`} strokeWidth={132} />
        <path d={MARK_PATHS.aperture} fill="none" stroke={`url(#${id("rim")})`} strokeWidth={132} />
      </svg>
      {children}
    </span>
  );
}
