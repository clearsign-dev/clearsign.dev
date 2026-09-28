"use client";

import { useState, type CSSProperties } from "react";
import { circleFrameAt, sideCircleCentres } from "@/components/chrome/circles/timeline";
import { ReadsCards } from "@/components/reads/ReadsCards";
import { ReadsHotspots } from "@/components/reads/ReadsHotspots";
import { Heading } from "@/components/reveal/Heading";
import { IconPlus } from "@/components/reveal/IconPlus";
import type { SectionProps } from "@/components/stage/Stage";
import { READS } from "@/lib/content";
import { prefersReducedMotion } from "@/lib/motion/easings";
import { beatProgress, clamp01, uiProgress } from "@/lib/motion/progress";
import { READS_TIMING, SUPPORTING_UI_REVEAL } from "@/lib/motion/timing";
import { SECTION_INDEX } from "@/lib/stage/sections";
import styles from "./Reads.module.css";

// What it reads. The heading sits at the bottom of the right half. On desktop
// the two groups live behind "eye" hotspots in the side circles; on touch and
// narrow layouts they become a row of cards that lift into place.

const HEADING = [...READS.heading];
const LONGEST_LINE = Math.max(...HEADING.map((line) => line.length));
const HIDDEN_EPSILON = 0.001;

// Where the circle background's side circles are at this point of the stage.
// Past 1 this section has just been left, so the clock reads from the next.
function sideCircles(progress: number, reducedMotion: boolean) {
  const frame =
    progress > 1
      ? circleFrameAt(SECTION_INDEX.reads + 1, progress - 1, reducedMotion)
      : circleFrameAt(SECTION_INDEX.reads, progress, reducedMotion);
  return sideCircleCentres(frame.width);
}

export function Reads({ progress, isMobileTiming }: SectionProps) {
  const [reducedMotion] = useState(() => prefersReducedMotion());
  const timing = isMobileTiming ? READS_TIMING.mobile : READS_TIMING.desktop;
  const ui = uiProgress(clamp01(progress), timing.window);
  const headingProgress = beatProgress(ui, timing.beats.heading);
  const groupProgress = READS.groups.map((_, i) =>
    beatProgress(ui, timing.beats.cards[Math.min(i, timing.beats.cards.length - 1)]),
  );

  const iconHidden = isMobileTiming
    ? headingProgress < SUPPORTING_UI_REVEAL
    : ui <= HIDDEN_EPSILON;

  return (
    <>
      <div
        className={styles.reads}
        style={{ "--reads-longest-line": LONGEST_LINE } as CSSProperties}
      >
        <Heading
          lines={HEADING}
          sup={READS.sup}
          position="bottom"
          progress={headingProgress}
          motion={timing.headingMotion}
          className={`mobile-padded ${styles.heading}`}
          lineClassName={styles.headingLine}
        />

        <IconPlus bottom="1.2rem" left={["-1.68rem", "0"]} desktopHide hidden={iconHidden} />

        <ReadsCards progress={groupProgress} />
      </div>

      <ReadsHotspots progress={groupProgress} circles={sideCircles(progress, reducedMotion)} />
    </>
  );
}
