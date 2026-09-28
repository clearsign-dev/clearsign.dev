"use client";

import { useSyncExternalStore } from "react";

// Layout tiers, matching the reference's breakpoints:
//   phone ≤ 766px, mobile (phone + tablet) ≤ 1024px, contact stacks ≤ 1255px.
export type LayoutFlags = {
  isMobile: boolean;
  isPhone: boolean;
  isContactStacked: boolean;
  isTouch: boolean;
};

const QUERIES = {
  isMobile: "(max-width: 1024px)",
  isPhone: "(max-width: 766px)",
  isContactStacked: "(max-width: 1255px)",
  isTouch: "(hover: none), (pointer: coarse)",
} as const;

const SERVER_FLAGS: LayoutFlags = {
  isMobile: false,
  isPhone: false,
  isContactStacked: false,
  isTouch: false,
};

let cached: LayoutFlags = SERVER_FLAGS;
let cacheKey = "";

function read(): LayoutFlags {
  const next = {
    isMobile: window.matchMedia(QUERIES.isMobile).matches,
    isPhone: window.matchMedia(QUERIES.isPhone).matches,
    isContactStacked: window.matchMedia(QUERIES.isContactStacked).matches,
    isTouch: window.matchMedia(QUERIES.isTouch).matches,
  };
  const key = `${+next.isMobile}${+next.isPhone}${+next.isContactStacked}${+next.isTouch}`;
  if (key !== cacheKey) {
    cacheKey = key;
    cached = next;
  }
  return cached;
}

function subscribe(listener: () => void) {
  const lists = Object.values(QUERIES).map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener("change", listener));
  return () => lists.forEach((l) => l.removeEventListener("change", listener));
}

export function useLayoutFlags(): LayoutFlags {
  return useSyncExternalStore(subscribe, read, () => SERVER_FLAGS);
}

export function readLayoutFlags(): LayoutFlags {
  return typeof window === "undefined" ? SERVER_FLAGS : read();
}
