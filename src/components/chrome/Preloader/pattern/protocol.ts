// Messages between the grid host (PatternCanvas) and the worker that renders
// it. Plain data only: this module must stay free of DOM and React.

export type Rgb = readonly [number, number, number];

/** Brand colours, resolved from the CSS tokens on the main thread. */
export type PatternTokens = {
  ground: Rgb;
  accent: Rgb;
  ink: Rgb;
};

export type ToWorker =
  | {
      type: "init";
      canvas: OffscreenCanvas;
      dpr: number;
      width: number;
      height: number;
      reducedMotion: boolean;
      tokens: PatternTokens;
      startFrom: number;
    }
  | { type: "resize"; width: number; height: number }
  | { type: "target"; value: number; ready: boolean }
  | { type: "pointer"; x: number; y: number }
  | { type: "active"; active: boolean }
  | { type: "dispose" };

export type FromWorker =
  | { type: "alive"; drawing: boolean }
  | { type: "progress"; value: number };
