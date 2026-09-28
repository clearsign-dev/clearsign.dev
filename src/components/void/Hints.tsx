"use client";

import { NOT_FOUND } from "@/lib/content";
import { KONAMI_GLYPHS, KONAMI_KEY_NAMES, KONAMI_KEYS, type KonamiKey } from "./useKonami";
import styles from "./Hints.module.css";

// Two hints, one after the other. The idle pill asks whether anyone is still
// there and offers the first two keys; once the code has begun, the full row
// of keys takes over and lights up as it is entered. Every key-cap is a button
// that enters its key, so the code can be clicked as well as typed.

export function IdleHint({ onKey }: { onKey: () => void }) {
  const first = KONAMI_KEYS[0];
  return (
    <div className={styles.idle} role="status">
      <span className={styles.idleText}>{NOT_FOUND.hint}</span>
      <span className={styles.idleKeys}>
        {[0, 1].map((i) => (
          <button
            key={i}
            type="button"
            className={styles.idleKey}
            onClick={onKey}
            aria-label={KONAMI_KEY_NAMES[first]}
          >
            <span aria-hidden="true">{KONAMI_GLYPHS[first]}</span>
          </button>
        ))}
      </span>
    </div>
  );
}

export function KonamiHint({ index, onPress }: { index: number; onPress: (key: KonamiKey) => void }) {
  return (
    <div className={styles.konami}>
      <div className={styles.glyphs}>
        {KONAMI_KEYS.map((key, i) => (
          <button
            key={i}
            type="button"
            className={styles.glyph}
            data-lit={i < index || undefined}
            onClick={() => onPress(key)}
            aria-label={KONAMI_KEY_NAMES[key]}
          >
            <span aria-hidden="true">{KONAMI_GLYPHS[key]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
