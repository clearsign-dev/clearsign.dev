"use client";

import { useId, type CSSProperties } from "react";
import { READS } from "@/lib/content";
import { clamp01, smoothstep } from "@/lib/motion/progress";
import styles from "./ReadsCards.module.css";

// Touch and narrow layouts: one card per group in a horizontal snap scroller
// above the heading. Each card lifts, un-tilts and settles as its beat plays,
// then its title and list follow a little behind.

const HIDDEN_EPSILON = 0.001;
const CARD_LIFT_PX = 52;
const CARD_OVERFLOW_ALLOWANCE_PX = CARD_LIFT_PX + 4;
const CARD_TILT_DEG = 6;
const CARD_START_SCALE = 0.965;
const TITLE_RISE_PX = 14;
const LIST_RISE_PX = 18;
const POINTER_READY = 0.24;

const layer = (progress: number, start: number, span: number) =>
  smoothstep(clamp01((progress - start) / span));

type ReadsCardsProps = {
  /** Reveal progress per group, 0..1. */
  progress: readonly number[];
};

export function ReadsCards({ progress }: ReadsCardsProps) {
  const baseId = useId();
  const titleId = (i: number) => `${baseId}-card-${i}`;
  const first = progress[0] ?? 0;

  return (
    <div
      className={styles.cards}
      role="region"
      aria-labelledby={READS.groups.map((_, i) => titleId(i)).join(" ")}
      tabIndex={first > POINTER_READY ? 0 : -1}
      style={
        {
          "--card-overflow-allowance": `${CARD_OVERFLOW_ALLOWANCE_PX}px`,
          pointerEvents: first > POINTER_READY ? "auto" : "none",
        } as CSSProperties
      }
    >
      {READS.groups.map((group, i) => {
        const p = progress[i] ?? 0;
        const inverse = 1 - p;
        const title = layer(p, 0.08, 0.7);
        const list = layer(p, 0.2, 0.72);
        const moving = p > HIDDEN_EPSILON && p < 1 - HIDDEN_EPSILON;
        return (
          <article
            key={group.title}
            className={styles.card}
            aria-labelledby={titleId(i)}
            style={{
              opacity: layer(p, 0, 0.72),
              transform: `perspective(900px) translate3d(0, ${inverse * CARD_LIFT_PX}px, 0) rotateX(${inverse * CARD_TILT_DEG}deg) scale(${CARD_START_SCALE + p * (1 - CARD_START_SCALE)})`,
              willChange: moving ? "transform, opacity" : "auto",
            }}
          >
            <h3
              id={titleId(i)}
              className={styles.title}
              style={{
                opacity: title,
                transform: `translate3d(0, ${(1 - title) * TITLE_RISE_PX}px, 0)`,
              }}
            >
              {group.title}
            </h3>
            <ul
              className={styles.list}
              style={{
                opacity: list,
                transform: `translate3d(0, ${(1 - list) * LIST_RISE_PX}px, 0)`,
              }}
            >
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
