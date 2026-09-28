"use client";

import { clsx } from "clsx";
import { useId } from "react";
import { MusicMixer } from "./MusicMixer";
import type { GameSettings, PadLabel, RunResult } from "./engine/types";
import styles from "./VoidHero.module.css";

const LANE_KEYS = ["D", "F", "J", "K"] as const;

function Keys() {
  return (
    <span className={styles.keys} aria-hidden="true">
      {LANE_KEYS.map((k) => (
        <kbd key={k} className={styles.kbd}>
          {k}
        </kbd>
      ))}
    </span>
  );
}

export function ReadyCta({ onStart }: { onStart: () => void }) {
  return (
    <div className={clsx(styles.cta, styles.ctaReady)}>
      <button type="button" className={styles.primary} onClick={onStart} data-autofocus>
        Start
      </button>
      <span className={styles.ctaHint}>Enter / Space</span>
      <span className={styles.legend}>
        <span className={styles.forKeys}>
          <Keys /> as each byte crosses the line
        </span>
        <span className={styles.forTouch}>Tap a lane as its byte crosses the line</span>
      </span>
    </div>
  );
}

export function EndedCta({ onRetry, onExit }: { onRetry: () => void; onExit: () => void }) {
  return (
    <div className={clsx(styles.cta, styles.ctaEnded)}>
      <div className={styles.ctaRow}>
        <button type="button" className={styles.primary} onClick={onRetry} data-autofocus>
          Retry
        </button>
        <button type="button" className={styles.secondary} onClick={onExit}>
          Exit
        </button>
      </div>
    </div>
  );
}

type ResultsPanelProps = {
  result: RunResult;
  settings: GameSettings;
  onRetry: () => void;
  onExit: () => void;
  onTrack: (id: string) => void;
  onVolume: (volume: number) => void;
  onMute: () => void;
};

export function ResultsPanel({ result, settings, onRetry, onExit, onTrack, onVolume, onMute }: ResultsPanelProps) {
  const titleId = useId();
  const critical = result.reason === "hearts";
  const rows: [string, string | number, boolean?][] = [
    ["Stage", result.stageName || "—"],
    ["Read", result.read],
    ["Blind", result.blind, true],
    ["Max combo", result.maxCombo],
    ["Best score", result.bestScore],
    ["Best stage", result.bestStage],
  ];

  return (
    <aside className={clsx(styles.panel, styles.results, critical && styles.resultsCritical)} aria-labelledby={titleId}>
      <span className={styles.eyebrow}>{critical ? "Run over" : "Run complete"}</span>
      {critical && <span className={styles.stamp}>Do not sign</span>}
      <h2 className={styles.resultsScore} id={titleId}>
        <span className={styles.srOnly}>Score </span>
        {result.score}
      </h2>
      {result.newBest && <span className={styles.newBest}>New best</span>}
      <dl className={styles.rows}>
        {rows.map(([label, value, blind]) => (
          <div key={label} className={clsx(styles.row, blind && styles.rowBlind)}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className={styles.resultsPhone}>
        <MusicMixer settings={settings} idSuffix="end" onTrack={onTrack} onVolume={onVolume} onMute={onMute} />
        <div className={styles.ctaRow}>
          <button type="button" className={styles.primary} onClick={onRetry} data-autofocus>
            Retry
          </button>
          <button type="button" className={styles.secondary} onClick={onExit}>
            Exit
          </button>
        </div>
      </div>
    </aside>
  );
}

export function ExitPanel({ onEnd }: { onEnd: () => void }) {
  return (
    <div className={clsx(styles.panel, styles.exitPanel)}>
      <span>Leave the run?</span>
      <button type="button" onClick={onEnd}>
        End run
      </button>
    </div>
  );
}

export function PausePanel({ onResume, onEnd }: { onResume: () => void; onEnd: () => void }) {
  const titleId = useId();
  return (
    <div className={clsx(styles.panel, styles.pause)} role="group" aria-labelledby={titleId}>
      <span className={styles.pauseTitle} id={titleId}>
        Paused
      </span>
      <div className={styles.ctaRow}>
        <button type="button" className={styles.primary} onClick={onResume} data-autofocus>
          Resume
        </button>
        <button type="button" className={styles.secondary} onClick={onEnd}>
          End run
        </button>
      </div>
      <span className={styles.ctaHint}>P to resume</span>
    </div>
  );
}

export type IdleHintKind = "start" | "keys";

export function IdleHint({ kind, onStart }: { kind: IdleHintKind; onStart: () => void }) {
  if (kind === "start") {
    return (
      <div className={clsx(styles.panel, styles.idleHint)} role="status">
        <span>Still here?</span>
        <button type="button" className={styles.hintButton} onClick={onStart}>
          Start
        </button>
        <kbd className={styles.kbd}>Enter</kbd>
      </div>
    );
  }
  return (
    <div className={clsx(styles.panel, styles.idleHint)} role="status">
      <span className={styles.forKeys}>
        Press <Keys /> when a byte meets the line
      </span>
      <span className={styles.forTouch}>Tap the lane when a byte meets the line</span>
    </div>
  );
}

export function PadLabels({ labels }: { labels: PadLabel[] }) {
  return (
    <div className={styles.padLabels} aria-hidden="true">
      {labels.map((p) => (
        <span key={p.label} className={styles.padLabel} style={{ left: p.x, top: p.y }}>
          {p.label}
        </span>
      ))}
    </div>
  );
}
