"use client";

import { clsx } from "clsx";
import type { PopupSpec, PopupTier, PopupTone } from "./engine/types";
import styles from "./VoidHero.module.css";

export type StoredPopup = PopupSpec & { id: number };

const TIER: Record<PopupTier, string> = {
  judgment: styles.popupJudgment,
  combo: styles.popupCombo,
  milestone: styles.popupMilestone,
};

const TONE: Record<PopupTone, string | undefined> = {
  ink: undefined,
  accent: styles.toneAccent,
  blind: styles.toneBlind,
  critical: styles.toneCritical,
};

export function ComboPopupLayer({ popups, onDone }: { popups: StoredPopup[]; onDone: (id: number) => void }) {
  return (
    <div className={styles.popups} aria-hidden="true">
      {popups.map((p) => (
        <span
          key={p.id}
          className={clsx(styles.popup, TIER[p.tier], TONE[p.tone])}
          style={{ left: p.x, top: p.y }}
          onAnimationEnd={() => onDone(p.id)}
        >
          {p.text}
        </span>
      ))}
    </div>
  );
}
