"use client";

import { useEffect } from "react";
import { HERO_INTRO_DELAY_MS, HERO_INTRO_PHASE, HERO_INTRO_PHASE_MOBILE } from "@/lib/motion/timing";
import { introPhase } from "@/lib/stage/intro";
import { canScroll, introStarted, preloader, useStore } from "@/lib/stage/store";
import { readLayoutFlags } from "@/lib/stage/useLayoutFlags";

// Runs the hero's intro once the preloader has gone. The hero headline's
// reveal normally unlocks scrolling just before it finishes (see Hero); the
// fallback here guarantees the page never stays locked if that is missed.
const UNLOCK_FALLBACK_MS = 2600;

export function IntroController() {
  const started = useStore(introStarted);

  // ?preloader=off skips the gate: for screenshots, QA and returning visitors
  // who arrive by a section link.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("preloader") === "off") {
      preloader.set({ progress: 100, ready: true, visible: false, leaving: false });
      introStarted.set(true);
    }
  }, []);

  useEffect(() => {
    if (!started) {
      introPhase.set(0);
      return;
    }
    const timers: number[] = [];
    const at = (phase: number, ms: number) => timers.push(window.setTimeout(() => introPhase.set(phase), ms));
    introPhase.set(HERO_INTRO_PHASE.logo);
    if (readLayoutFlags().isMobile) {
      const d = HERO_INTRO_DELAY_MS.mobile;
      at(HERO_INTRO_PHASE_MOBILE.buttons, d.buttons);
      at(HERO_INTRO_PHASE_MOBILE.heading, d.heading);
      at(HERO_INTRO_PHASE_MOBILE.primaryText, d.primaryText);
      at(HERO_INTRO_PHASE_MOBILE.secondaryText, d.secondaryText);
      at(HERO_INTRO_PHASE_MOBILE.scrollIndicator, d.scrollIndicator);
    } else {
      const d = HERO_INTRO_DELAY_MS.desktop;
      at(HERO_INTRO_PHASE.uiGroup, d.uiGroup);
      at(HERO_INTRO_PHASE.menuButtons, d.menuButtons);
      at(HERO_INTRO_PHASE.primaryText, d.primaryText);
      at(HERO_INTRO_PHASE.secondaryText, d.secondaryText);
      at(HERO_INTRO_PHASE.heading, d.heading);
    }
    timers.push(window.setTimeout(() => canScroll.set(true), UNLOCK_FALLBACK_MS));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [started]);

  return null;
}
