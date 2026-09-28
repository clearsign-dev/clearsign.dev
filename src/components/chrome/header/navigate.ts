import { canScroll, goToSection } from "@/lib/stage/store";
import { runSmokeTransition } from "../SmokeTransition";

// How the header and the menu move the stage: under the full-screen smoke, as
// on the reference. Nothing happens until the intro has unlocked scrolling.
// (The tick indicator jumps without smoke and calls goToSection directly.)
export function navigateToSection(index: number): Promise<void> {
  if (!canScroll.get()) return Promise.resolve();
  return runSmokeTransition(() => goToSection(index));
}
