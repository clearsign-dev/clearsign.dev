"use client";

import { useSyncExternalStore } from "react";
import type { StageProgress } from "./sections";

// A minimal external store. The stage updates progress every animation frame,
// so state lives outside React and components subscribe to the slice they use.
export type Store<T> = {
  get: () => T;
  set: (next: T | ((prev: T) => T)) => void;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<T>(initial: T): Store<T> {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next) {
      const value = typeof next === "function" ? (next as (p: T) => T)(state) : next;
      if (Object.is(value, state)) return;
      state = value;
      listeners.forEach((l) => l());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useStore<T>(store: Store<T>): T;
export function useStore<T, S>(store: Store<T>, select: (state: T) => S): S;
export function useStore<T, S>(store: Store<T>, select?: (state: T) => S): T | S {
  const getSnapshot = () => (select ? select(store.get()) : store.get());
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}

/** Section progress, driven by the scroll track. */
export const stageProgress = createStore<StageProgress>({ step: 0, value: 0, global: 0 });

/** Raw 0..1 scroll position (the right-edge scrollbar reads this). */
export const scrollProgress = createStore(0);

export type PreloaderState = {
  /** 0..100, what the loading counter shows. */
  progress: number;
  /** Everything the scene needs is ready. */
  ready: boolean;
  /** The preloader overlay is still on screen. */
  visible: boolean;
  /** The START button was pressed and the overlay is animating away. */
  leaving: boolean;
};

// Skip the gate with ?preloader=off (useful for screenshots and QA).
export const preloader = createStore<PreloaderState>({
  progress: 0,
  ready: false,
  visible: true,
  leaving: false,
});

/** The intro has played far enough that scrolling is allowed. Stays true. */
export const canScroll = createStore(false);

/** Set when the preloader has fully gone and the intro may start. */
export const introStarted = createStore(false);

/** Ambient sound. Off until the visitor chooses. */
export const soundOn = createStore(false);

export const menuOpen = createStore(false);

export type CursorState = {
  /** Short label the custom cursor shows, e.g. "Proceed" or "Drag". */
  label: string | null;
  /** The cursor is over something interactive. */
  active: boolean;
};

export const cursor = createStore<CursorState>({ label: null, active: false });

// The stage registers its navigation here so the header, menu and indicator
// can move it without knowing how it scrolls.
type StageNavigator = {
  toSection: (index: number, options?: { immediate?: boolean }) => void;
  toProgress: (global: number, options?: { immediate?: boolean }) => void;
};

let navigator: StageNavigator | null = null;

export function registerNavigator(next: StageNavigator | null) {
  navigator = next;
}

export function goToSection(index: number, options?: { immediate?: boolean }) {
  navigator?.toSection(index, options);
}

export function goToProgress(global: number, options?: { immediate?: boolean }) {
  navigator?.toProgress(global, options);
}
