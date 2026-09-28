import type { CSSProperties } from "react";
import { clamp01 } from "@/lib/motion/progress";

// Scroll-scrubbed reveal for a whole block (the reference's text reveal with
// splitting off): it fades in and rises from `offsetY` px below. The scrub is
// raised to a power first, so the start lingers, then eased out with a quartic
// ("power3.out"). Hidden outright at zero, so it cannot take a click.

const SCRUB_POWER = 1.25;
const easeOutQuart = (t: number) => 1 - (1 - t) ** 4;

export function blockReveal(progress: number, offsetY: number, reduced = false): CSSProperties {
  const t = clamp01(progress) ** SCRUB_POWER;
  const e = easeOutQuart(t);
  return {
    opacity: e,
    visibility: t <= 0 ? "hidden" : "visible",
    transform: reduced ? undefined : `translate3d(0, ${((1 - e) * offsetY).toFixed(2)}px, 0)`,
  };
}

/** Fade and rise by `offsetY` px, from an already-eased 0..1 value. */
export function rise(show: number, offsetY: number, reduced = false): CSSProperties {
  return {
    opacity: show,
    transform: reduced ? undefined : `translate3d(0, ${((1 - show) * offsetY).toFixed(2)}px, 0)`,
  };
}
