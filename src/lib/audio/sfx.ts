// Interface sounds. The engine behind these is synthesised with Web Audio
// (see ./engine.ts); nothing is downloaded. Calls are safe before the engine
// exists and while sound is off: they simply do nothing.

export type SfxKey = "hover" | "click" | "clickAlt" | "transition";

type SfxPlayer = (key: SfxKey) => void;

let player: SfxPlayer | null = null;

export function registerSfxPlayer(next: SfxPlayer | null) {
  player = next;
}

export function playSfx(key: SfxKey) {
  player?.(key);
}
