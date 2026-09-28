"use client";

import { useEffect } from "react";
import {
  disposeAudio,
  playEngineSfx,
  restoreVolume,
  resumeIfWanted,
  saveSoundPreference,
  setAudioHidden,
  setSoundEnabled,
} from "@/lib/audio/engine";
import { registerSfxPlayer } from "@/lib/audio/sfx";
import { soundOn } from "@/lib/stage/store";

// Connects the stores to the Web Audio engine. Mount once; renders nothing.
//
// The subscription to `soundOn` is deliberately a direct store subscription,
// not a React effect: the store notifies synchronously, so when the preloader's
// START or the sound pill sets it inside a click, the audio context is created
// and resumed inside that same click. Safari will not start it any later.
export function AudioEngine() {
  useEffect(() => {
    restoreVolume();
    registerSfxPlayer(playEngineSfx);

    let on = soundOn.get();
    if (on) setSoundEnabled(true);
    const stopSound = soundOn.subscribe(() => {
      const next = soundOn.get();
      if (next === on) return;
      on = next;
      setSoundEnabled(next);
      saveSoundPreference(next);
    });

    // Every click on the page ticks: a lower click on buttons and links.
    const onBodyClick = (event: MouseEvent) => {
      const target = event.target;
      const interactive = target instanceof Element && target.closest("button, a") !== null;
      playEngineSfx(interactive ? "clickAlt" : "click");
    };
    document.body.addEventListener("click", onBodyClick);

    // Any later gesture brings back a context the browser blocked or interrupted.
    const onGesture = () => resumeIfWanted();
    const gestureOptions = { capture: true, passive: true } as const;
    window.addEventListener("pointerdown", onGesture, gestureOptions);
    window.addEventListener("keydown", onGesture, gestureOptions);

    const onVisibility = () => setAudioHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();

    return () => {
      stopSound();
      document.body.removeEventListener("click", onBodyClick);
      window.removeEventListener("pointerdown", onGesture, gestureOptions);
      window.removeEventListener("keydown", onGesture, gestureOptions);
      document.removeEventListener("visibilitychange", onVisibility);
      registerSfxPlayer(null);
      disposeAudio();
    };
  }, []);

  return null;
}
