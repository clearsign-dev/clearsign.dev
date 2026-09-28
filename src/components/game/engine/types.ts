// Shared shapes between the game engine and the React layer around it.

export type GamePhase = "ready" | "playing" | "ended";

export type PopupTier = "judgment" | "combo" | "milestone";
export type PopupTone = "ink" | "accent" | "blind" | "critical";

export interface PopupSpec {
  text: string;
  tier: PopupTier;
  tone: PopupTone;
  /** Viewport pixels. */
  x: number;
  y: number;
}

export interface PadLabel {
  label: string;
  x: number;
  y: number;
}

export interface HudState {
  score: number;
  combo: number;
  lives: number;
  maxLives: number;
  stageName: string;
  /** 0..1 toward the next stage. */
  stageProgress: number;
  bestScore: number;
}

export type RunEndReason = "hearts" | "quit";

export interface RunResult {
  reason: RunEndReason;
  score: number;
  stageName: string;
  read: number;
  blind: number;
  maxCombo: number;
  bestScore: number;
  bestStage: string;
  newBest: boolean;
}

export type PlayHint = "keys";

export interface GameSettings {
  trackId: string;
  volume: number;
  muted: boolean;
}

export interface GameCallbacks {
  onHud(hud: HudState): void;
  onPopup(popup: PopupSpec): void;
  onPadLabels(labels: PadLabel[]): void;
  onRunEnd(result: RunResult): void;
  onPause(paused: boolean): void;
  onHint(hint: PlayHint | null): void;
}
