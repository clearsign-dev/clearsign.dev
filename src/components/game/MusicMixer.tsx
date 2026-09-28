"use client";

import { clsx } from "clsx";
import { TRACKS, levelOf, trackGlyph, type Level } from "./engine/tracks";
import type { GameSettings } from "./engine/types";
import styles from "./VoidHero.module.css";

// Each tile draws its track's first bar from the sequencer data itself:
// kick, snare, hats and melody as four rows of sixteen steps.
const GLYPHS = new Map(TRACKS.map((track) => [track.id, trackGlyph(track)]));

function Glyph({ rows }: { rows: boolean[][] }) {
  return (
    <svg className={styles.glyph} viewBox="0 0 32 8" aria-hidden="true">
      {rows.map((row, r) =>
        row.map((on, c) => (
          <circle
            key={`${r}-${c}`}
            cx={1 + c * 2}
            cy={1 + r * 2}
            r={0.62}
            className={on ? styles.glyphOn : styles.glyphOff}
          />
        )),
      )}
    </svg>
  );
}

function LevelBars({ level }: { level: Level }) {
  return (
    <svg className={styles.level} viewBox="0 0 11 8" aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={i * 4}
          y={8 - (3 + i * 2.5)}
          width={3}
          height={3 + i * 2.5}
          rx={0.6}
          className={i < level ? styles.levelLit : styles.levelUnlit}
        />
      ))}
    </svg>
  );
}

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg className={styles.speaker} viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 6h2.6L8.4 3v10L4.6 10H2z" />
      {muted ? (
        <path d="M10.5 5.8l4 4.4M14.5 5.8l-4 4.4" className={styles.speakerStroke} />
      ) : (
        <path d="M10.6 5.6a3.4 3.4 0 0 1 0 4.8M12.4 3.9a5.8 5.8 0 0 1 0 8.2" className={styles.speakerStroke} />
      )}
    </svg>
  );
}

type MusicMixerProps = {
  settings: GameSettings;
  idSuffix: string;
  onTrack: (id: string) => void;
  onVolume: (volume: number) => void;
  onMute: () => void;
};

export function MusicMixer({ settings, idSuffix, onTrack, onVolume, onMute }: MusicMixerProps) {
  const current = TRACKS.find((t) => t.id === settings.trackId) ?? TRACKS[0];
  const currentLevel = levelOf(current);
  const volumeId = `bytehero-volume-${idSuffix}`;
  const tracksId = `bytehero-tracks-${idSuffix}`;

  return (
    <div className={styles.mixer}>
      <div className={styles.mixerSection}>
        <span className={styles.mixerLabel} id={tracksId}>
          Track
        </span>
        <div className={styles.tiles} role="group" aria-labelledby={tracksId}>
          <button
            type="button"
            className={clsx(styles.tile, styles.tileMute, settings.muted && styles.tileActive)}
            aria-pressed={settings.muted}
            aria-label="Mute"
            title="Mute (M)"
            onClick={onMute}
          >
            <SpeakerIcon muted={settings.muted} />
          </button>
          {TRACKS.map((track) => {
            const level = levelOf(track);
            const active = track.id === settings.trackId;
            return (
              <button
                key={track.id}
                type="button"
                className={clsx(styles.tile, active && styles.tileActive)}
                aria-pressed={active}
                aria-label={`${track.label}, ${track.bpm} BPM, ${level.label}`}
                title={`${track.label} · ${level.label}`}
                onClick={() => onTrack(track.id)}
              >
                <Glyph rows={GLYPHS.get(track.id) ?? []} />
                <LevelBars level={level.level} />
              </button>
            );
          })}
        </div>
        <span className={styles.trackName}>
          <span>{current.label}</span>
          <span className={styles.trackMeta}>
            {current.bpm} BPM · {currentLevel.label}
          </span>
        </span>
      </div>

      <div className={styles.mixerSection}>
        <label className={styles.mixerLabel} htmlFor={volumeId}>
          Volume
        </label>
        <input
          id={volumeId}
          className={styles.slider}
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(settings.volume * 100)}
          onChange={(e) => onVolume(Number(e.currentTarget.value) / 100)}
        />
      </div>
    </div>
  );
}
