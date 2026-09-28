"use client";

import { useSyncExternalStore } from "react";

// prefers-reduced-motion as a live, hydration-safe value (false on the server).

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(listener: () => void) {
  const list = window.matchMedia(QUERY);
  list.addEventListener("change", listener);
  return () => list.removeEventListener("change", listener);
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}
