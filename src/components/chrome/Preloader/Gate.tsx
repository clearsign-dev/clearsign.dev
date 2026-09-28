"use client";

import { useState, type Ref } from "react";
import { PRELOADER } from "@/lib/content";
import { DotGlyph } from "./DotGlyph";
import styles from "./Gate.module.css";

// The gate: a glowing orb, "Enter with sound", a line about what the sound is,
// and START. The orb is decorative; START is the one control on the screen.

type GateProps = {
  ready: boolean;
  leaving: boolean;
  onStart: () => void;
  startRef: Ref<HTMLButtonElement>;
  titleId: string;
  subtitleId: string;
};

export function Gate({ ready, leaving, onStart, startRef, titleId, subtitleId }: GateProps) {
  const [hovered, setHovered] = useState(false);
  // The orb's glyph comes alive while the pointer rests on START.
  const live = ready && !leaving && hovered;

  return (
    <div
      className={styles.gate}
      data-ready={ready || undefined}
      data-leaving={leaving || undefined}
      inert={!ready || leaving}
    >
      <div className={styles.orb} data-live={live || undefined} aria-hidden="true">
        <DotGlyph live={live} className={styles.glyph} />
      </div>
      <div className={styles.lines}>
        <p className={styles.line}>
          <span id={titleId} className={`${styles.label} ${styles.title}`}>
            {PRELOADER.gate.title}
          </span>
        </p>
        <p className={`${styles.line} ${styles.subtitleLine}`}>
          <span id={subtitleId} className={`${styles.label} ${styles.subtitle}`}>
            {PRELOADER.gate.subtitle}
          </span>
        </p>
      </div>
      <button
        ref={startRef}
        type="button"
        className={styles.start}
        onClick={onStart}
        onPointerEnter={(event) => {
          if (event.pointerType !== "touch") setHovered(true);
        }}
        onPointerLeave={() => setHovered(false)}
      >
        {PRELOADER.gate.button}
      </button>
    </div>
  );
}
