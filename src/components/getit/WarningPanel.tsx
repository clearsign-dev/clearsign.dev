"use client";

import { useId, type CSSProperties } from "react";
import type { WARNING } from "@/lib/content";
import styles from "./WarningPanel.module.css";

// The standing warning that has to sit next to any download: a kicker, the
// warning itself, and why the risky commands are locked away.

type WarningPanelProps = {
  warning: typeof WARNING;
  /** 0..1, revealed together with the step cards. */
  revealProgress: number;
  className?: string;
};

const SETTLED = 0.999;

export function WarningPanel({ warning, revealProgress: r, className = "" }: WarningPanelProps) {
  const labelId = useId();
  const style: CSSProperties = {
    opacity: r,
    transform: r >= SETTLED ? "none" : `translate3d(0, ${((1 - r) * 24).toFixed(2)}px, 0)`,
  };

  return (
    <div role="note" aria-labelledby={labelId} className={`${styles.panel} ${className}`} style={style}>
      <p id={labelId} className={styles.label}>
        {warning.label}
      </p>
      <p className={styles.headline}>{warning.headline}</p>
      <p className={styles.body}>{warning.body}</p>
    </div>
  );
}
