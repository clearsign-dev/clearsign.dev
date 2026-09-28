"use client";

import { clsx } from "clsx";
import type { MouseEvent } from "react";
import { Mark } from "@/components/brand/Mark";
import { MusicMixer } from "./MusicMixer";
import type { GamePhase, GameSettings, HudState } from "./engine/types";
import styles from "./VoidHero.module.css";

const HEART = "M8 14.2 2.2 8.6A3.6 3.6 0 0 1 8 3.9a3.6 3.6 0 0 1 5.8 4.7Z";
const CRACK = "M8.7 4.4 7.1 7.3l2.2 1.6-1.7 3.4";

function Hearts({ lives, max }: { lives: number; max: number }) {
  return (
    <div className={styles.hearts} role="img" aria-label={`${lives} of ${max} hearts`}>
      {Array.from({ length: max }, (_, i) => (
        <svg
          key={i}
          viewBox="0 0 16 16"
          className={clsx(styles.heart, i < lives ? styles.heartFull : styles.heartLost)}
          aria-hidden="true"
        >
          <path className={styles.heartBody} d={HEART} />
          <path className={styles.heartCrack} d={CRACK} />
        </svg>
      ))}
    </div>
  );
}

type GameHudProps = {
  title: string;
  phase: GamePhase;
  paused: boolean;
  hud: HudState;
  settings: GameSettings;
  onTrack: (id: string) => void;
  onVolume: (volume: number) => void;
  onMute: () => void;
  onPause: (paused: boolean) => void;
  /** Hands focus back to the dialog after a pointer click during play. */
  onPointerAction: (event: MouseEvent) => void;
};

export function GameHud({
  title,
  phase,
  paused,
  hud,
  settings,
  onTrack,
  onVolume,
  onMute,
  onPause,
  onPointerAction,
}: GameHudProps) {
  const playing = phase === "playing";
  const progress = Math.round(Math.max(0, Math.min(1, hud.stageProgress)) * 100);

  return (
    <section className={clsx(styles.panel, styles.hud, playing && styles.hudPlaying)} aria-label="Game status">
      <div className={styles.hudTitle}>
        <span className={styles.hudBrand}>
          <span className={styles.hudMark} aria-hidden="true">
            <Mark size={14} title="" />
          </span>
          {title}
        </span>
        <span className={styles.hudKeys}>
          {playing && (
            <button
              type="button"
              className={clsx(styles.keyButton, paused && styles.keyButtonOn)}
              aria-pressed={paused}
              aria-label="Pause"
              title="Pause (P)"
              onClick={(e) => {
                onPause(!paused);
                onPointerAction(e);
              }}
            >
              P
            </button>
          )}
          <button
            type="button"
            className={clsx(styles.keyButton, settings.muted && styles.keyButtonOn, settings.muted && styles.keyStruck)}
            aria-pressed={settings.muted}
            aria-label="Mute"
            title="Mute (M)"
            onClick={(e) => {
              onMute();
              onPointerAction(e);
            }}
          >
            M
          </button>
        </span>
      </div>

      {phase !== "ready" && (
        <dl className={styles.stats}>
          <div className={styles.stat}>
            <dt>Score</dt>
            <dd>{hud.score}</dd>
          </div>
          <div className={styles.stat}>
            <dt>Combo</dt>
            <dd>{hud.combo}</dd>
          </div>
        </dl>
      )}

      {playing && hud.stageName && (
        <div className={styles.stage}>
          <span className={styles.stageName}>{hud.stageName}</span>
          <div
            className={styles.progress}
            role="progressbar"
            aria-label="Next stage"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div className={styles.progressFill} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      <Hearts lives={hud.lives} max={hud.maxLives} />

      <div className={styles.hudMixer}>
        <MusicMixer settings={settings} idSuffix="hud" onTrack={onTrack} onVolume={onVolume} onMute={onMute} />
      </div>
    </section>
  );
}
