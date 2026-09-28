"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// The Konami code: ↑ ↑ ↓ ↓ ← → ← → B A. A right key advances; a wrong key
// starts over, or counts as the first step if it was ↑. A pause of 2.4s
// without progress forgets the attempt.

export const KONAMI_KEYS = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const;

export type KonamiKey = (typeof KONAMI_KEYS)[number];

export const KONAMI_GLYPHS: Record<KonamiKey, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  b: "B",
  a: "A",
};

export const KONAMI_KEY_NAMES: Record<KonamiKey, string> = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  b: "B",
  a: "A",
};

const FORGET_AFTER_MS = 2400;

const normalise = (key: string) => (key.startsWith("Arrow") ? key : key.toLowerCase());

type Options = {
  enabled: boolean;
  onComplete: () => void;
};

export function useKonami({ enabled, onComplete }: Options) {
  const [index, setIndex] = useState(0);
  const indexRef = useRef(0);
  const timer = useRef<number | null>(null);
  const completeRef = useRef(onComplete);

  useEffect(() => {
    completeRef.current = onComplete;
  }, [onComplete]);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const commit = useCallback(
    (next: number) => {
      indexRef.current = next;
      setIndex(next);
      clearTimer();
      if (next > 0) {
        timer.current = window.setTimeout(() => {
          timer.current = null;
          indexRef.current = 0;
          setIndex(0);
        }, FORGET_AFTER_MS);
      }
    },
    [clearTimer],
  );

  const reset = useCallback(() => commit(0), [commit]);

  const press = useCallback(
    (rawKey: string) => {
      const key = normalise(rawKey);
      const expected = KONAMI_KEYS[indexRef.current];
      if (key !== expected) {
        commit(key === KONAMI_KEYS[0] ? 1 : 0);
        return;
      }
      const next = indexRef.current + 1;
      if (next === KONAMI_KEYS.length) {
        commit(0);
        completeRef.current();
        return;
      }
      commit(next);
    },
    [commit],
  );

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      press(event.key);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, press]);

  // Turning the listener off forgets any attempt in progress.
  useEffect(() => {
    if (enabled) return;
    clearTimer();
    indexRef.current = 0;
    const frame = requestAnimationFrame(() => setIndex(0));
    return () => cancelAnimationFrame(frame);
  }, [enabled, clearTimer]);

  useEffect(() => clearTimer, [clearTimer]);

  return { index, press, reset };
}
