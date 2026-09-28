import { preloader } from "@/lib/stage/store";

// What the counter is heading for. The 3D scene reports progress and
// readiness to the preloader store; this adds two safety nets without writing
// anything back to the store:
//   - if nothing has reported after SYNTHETIC_AFTER_MS, a slow synthetic
//     target joins in, so the page never sits at 0;
//   - if the scene is still not ready after FORCE_READY_AFTER_MS, loading is
//     treated as finished (for example, a browser without WebGL).

export const SYNTHETIC_AFTER_MS = 1500;
export const FORCE_READY_AFTER_MS = 10_000;

// Approaches, never reaches, SYNTHETIC_CEILING, so the counter still holds at
// 99 until something real (or the timeout) says ready.
const SYNTHETIC_CEILING = 92;
const SYNTHETIC_TIME_CONSTANT_MS = 3500;
const POLL_MS = 100;

function syntheticAt(ms: number): number {
  return SYNTHETIC_CEILING * (1 - Math.exp(-Math.max(0, ms) / SYNTHETIC_TIME_CONSTANT_MS));
}

export function watchLoadTarget(onChange: (target: number, ready: boolean) => void): () => void {
  const startedAt = performance.now();
  let synthetic = false;
  let forced = false;
  let lastTarget = -1;
  let lastReady = false;
  let poll = 0;

  const emit = () => {
    const state = preloader.get();
    const elapsed = performance.now() - startedAt;
    if (!synthetic && elapsed >= SYNTHETIC_AFTER_MS && state.progress <= 0 && !state.ready) {
      synthetic = true;
    }
    const target = Math.max(state.progress, synthetic ? syntheticAt(elapsed - SYNTHETIC_AFTER_MS) : 0);
    const ready = state.ready || forced;
    if (Math.abs(target - lastTarget) >= 0.05 || ready !== lastReady) {
      lastTarget = target;
      lastReady = ready;
      onChange(target, ready);
    }
    if (ready && poll) {
      window.clearInterval(poll);
      poll = 0;
    }
  };

  const unsubscribe = preloader.subscribe(emit);
  poll = window.setInterval(emit, POLL_MS);
  const force = window.setTimeout(() => {
    forced = true;
    emit();
  }, FORCE_READY_AFTER_MS);
  emit();

  return () => {
    unsubscribe();
    window.clearInterval(poll);
    window.clearTimeout(force);
  };
}
