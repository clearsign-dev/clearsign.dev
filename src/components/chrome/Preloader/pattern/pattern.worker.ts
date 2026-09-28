import { createPatternEngine, type PatternEngine } from "./engine";
import type { FromWorker, ToWorker } from "./protocol";

// Renders the preloader grid off the main thread, so the 3D scene's warm-up
// cannot stall the bar or the counter. The engine is the same one the main
// thread falls back to.

type WorkerScope = {
  postMessage: (message: FromWorker) => void;
  onmessage: ((event: MessageEvent<ToWorker>) => void) | null;
};

const scope = self as unknown as WorkerScope;
let engine: PatternEngine | null = null;

scope.onmessage = (event) => {
  const message = event.data;
  switch (message.type) {
    case "init":
      engine?.dispose();
      engine = createPatternEngine({
        canvas: message.canvas,
        dpr: message.dpr,
        reducedMotion: message.reducedMotion,
        tokens: message.tokens,
        startFrom: message.startFrom,
        onProgress: (value) => scope.postMessage({ type: "progress", value }),
      });
      engine.resize(message.width, message.height);
      engine.start();
      scope.postMessage({ type: "alive", drawing: engine.canDraw });
      break;
    case "resize":
      engine?.resize(message.width, message.height);
      break;
    case "target":
      engine?.setTarget(message.value, message.ready);
      break;
    case "pointer":
      engine?.pointer(message.x, message.y);
      break;
    case "active":
      engine?.setActive(message.active);
      break;
    case "dispose":
      engine?.dispose();
      engine = null;
      break;
  }
};
