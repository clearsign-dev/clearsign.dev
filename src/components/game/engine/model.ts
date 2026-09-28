// Engine-internal state shared by the simulation (game.ts) and the drawing
// (render.ts).

import type { RGB } from "./palette";

export const LANE_COUNT = 4;

export type NoteState = "live" | "held" | "read" | "blind" | "dropped";

export interface Note {
  lane: number;
  /** Context-clock time the byte reaches the signing line: its step's time. */
  hitTime: number;
  holdSec: number;
  endTime: number;
  hex: string;
  state: NoteState;
  /** The head was read (a hold that is or was held). */
  headHit: boolean;
  /** Clock time of the last state change, for fades. */
  changedAt: number;
  partner: Note | null;
}

export interface LaneFx {
  /** Tap punch, 1 on press. */
  press: number;
  /** Lane surface glow, 1 on press. */
  pulse: number;
  /** 0..1, nearest incoming byte. */
  approach: number;
  /** Critical flash on an Early press. */
  missFlash: number;
  /** Smoothed "key is down" charge. */
  force: number;
  /** Latched while a press found nothing, cleared on release. */
  noNote: boolean;
  /** Core fill while a hold is locked. */
  coreFill: number;
  corePulse: number;
  /** Perfect-hit pop. */
  pop: number;
}

export type FxKind = "ring" | "beam" | "bolt" | "impact";

export interface Fx {
  kind: FxKind;
  lane: number;
  life: number;
  max: number;
  color: RGB;
  big: boolean;
  alpha: number;
  /** Ring sizes (px) from/to. */
  w0: number;
  w1: number;
  h0: number;
  h1: number;
}

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  char: string;
  color: RGB;
  size: number;
}

export interface BeatGrid {
  t0: number;
  beatSec: number;
}

export interface SceneState {
  /** 0..1 linear open progress (staggered inside the renderer). */
  reveal: number;
  /** 0..1 how far the highway is dimmed after a run. */
  dim: number;
  critical: boolean;
  beat: number;
  flash: number;
  now: number;
  travel: number;
  elapsed: number;
  grid: BeatGrid | null;
  notes: readonly Note[];
  lanes: readonly LaneFx[];
  fx: readonly Fx[];
  sparks: readonly Spark[];
  shakeX: number;
  shakeY: number;
  showSignLabel: boolean;
}
