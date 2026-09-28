"use client";

import { memo, useCallback, type CSSProperties, type PointerEvent } from "react";
import styles from "./SlideCard.module.css";

export type EvidenceSlide = {
  kicker: string;
  figure: string;
  title: string;
  body: string;
  gap?: boolean;
};

type SlideCardProps = {
  slide: EvidenceSlide;
  index: number;
  count: number;
  /** The slide the train is centred on. */
  focused: boolean;
  /** Narrow layouts: the focused card breathes a faint accent edge. */
  hint: boolean;
  register: (index: number, el: HTMLDivElement | null) => void;
};

const pad = (n: number) => String(n).padStart(2, "0");

// One evidence card. Its position is written by the train every frame; the
// card only owns its content, its surface and the pointer glow.
export const SlideCard = memo(function SlideCard({
  slide,
  index,
  count,
  focused,
  hint,
  register,
}: SlideCardProps) {
  const setRef = useCallback((el: HTMLDivElement | null) => register(index, el), [index, register]);

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== "mouse") return;
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    el.style.setProperty("--glow-x", `${(((event.clientX - rect.left) / rect.width) * 100).toFixed(1)}%`);
    el.style.setProperty("--glow-y", `${(((event.clientY - rect.top) / rect.height) * 100).toFixed(1)}%`);
    el.style.setProperty("--glow", "1");
  };

  const onPointerLeave = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty("--glow", "0");
  };

  return (
    <div
      ref={setRef}
      className={styles.card}
      role="group"
      aria-roledescription="slide"
      aria-label={`${index + 1} of ${count}`}
      data-slide-index={index}
      data-cursor="grab"
      data-focused={focused ? "true" : undefined}
      data-hint={hint ? "true" : undefined}
      data-gap={slide.gap ? "true" : undefined}
      style={{ "--chars": slide.figure.length } as CSSProperties}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <span className={styles.glow} aria-hidden="true" />
      <div className={styles.inner}>
        <div className={styles.head}>
          <p className={styles.kicker}>
            <span className={styles.dot} aria-hidden="true" />
            {slide.kicker}
          </p>
          <span className={styles.index} aria-hidden="true">
            {pad(index + 1)} / {pad(count)}
          </span>
        </div>
        <p className={styles.figure}>{slide.figure}</p>
        <div className={styles.text}>
          <h3 className={styles.title}>{slide.title}</h3>
          <p className={styles.body}>{slide.body}</p>
        </div>
      </div>
      <span className={styles.shade} aria-hidden="true" />
      <span className={styles.ring} aria-hidden="true" />
    </div>
  );
});
