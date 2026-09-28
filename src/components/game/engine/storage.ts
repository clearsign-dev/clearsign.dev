// Preferences and records, kept in this browser only. Every access is guarded:
// storage can be missing or throw (private windows, blocked site data).

import { DEFAULT_TRACK_ID, trackById } from "./tracks";
import type { GameSettings } from "./types";

const KEYS = {
  track: "bytehero.track",
  volume: "bytehero.volume",
  muted: "bytehero.muted",
  bestScore: "bytehero.best-score",
  bestSteps: "bytehero.best-steps",
} as const;

export const DEFAULT_VOLUME = 0.55;

function read(key: string): string | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: keep it in memory only */
  }
}

function readCount(key: string): number {
  const n = Number.parseInt(read(key) ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function readSettings(): GameSettings {
  const volume = Number.parseFloat(read(KEYS.volume) ?? "");
  return {
    trackId: trackById(read(KEYS.track) ?? DEFAULT_TRACK_ID).id,
    volume: Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : DEFAULT_VOLUME,
    muted: read(KEYS.muted) === "1",
  };
}

export function saveTrack(id: string) {
  write(KEYS.track, id);
}

export function saveVolume(volume: number) {
  write(KEYS.volume, volume.toFixed(3));
}

export function saveMuted(muted: boolean) {
  write(KEYS.muted, muted ? "1" : "0");
}

export interface Best {
  score: number;
  steps: number;
}

export function readBest(): Best {
  return { score: readCount(KEYS.bestScore), steps: readCount(KEYS.bestSteps) };
}

export function saveBest(best: Best) {
  write(KEYS.bestScore, String(Math.floor(best.score)));
  write(KEYS.bestSteps, String(Math.floor(best.steps)));
}
