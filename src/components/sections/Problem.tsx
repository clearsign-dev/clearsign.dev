"use client";

import type { CSSProperties } from "react";
import { Heading } from "@/components/reveal/Heading";
import { IconPlus } from "@/components/reveal/IconPlus";
import { RevealText } from "@/components/reveal/RevealText";
import type { SectionProps } from "@/components/stage/Stage";
import { PROBLEM } from "@/lib/content";
import { beatProgress, linearBeatProgress, uiProgress } from "@/lib/motion/progress";
import { PROBLEM_TIMING, SUPPORTING_UI_REVEAL } from "@/lib/motion/timing";
import styles from "./Problem.module.css";

// The problem, stated in the right half: a large two-line heading at the top,
// two paragraphs at the bottom. Everything is scrubbed by scroll, and the UI
// keeps fading out across the opening of the next section (a holdover).

const HEADING = [...PROBLEM.heading];
const LONGEST_LINE = Math.max(...HEADING.map((line) => line.length));

const HIDDEN_EPSILON = 0.001;
const COPY_SCRUB_POWER = { desktop: 1.14, mobile: 1.06 } as const;

export function Problem({ progress, isMobileTiming }: SectionProps) {
  const timing = isMobileTiming ? PROBLEM_TIMING.mobile : PROBLEM_TIMING.desktop;
  // Raw progress: past 1 while the next section opens, which the window's
  // hideEnd (> 1) turns into the fade-out.
  const ui = uiProgress(progress, timing.window);
  // The reference choreographs mobile on straight beats and desktop on eased ones.
  const shape = isMobileTiming ? linearBeatProgress : beatProgress;
  const headingProgress = shape(ui, timing.beats.heading);
  const copyProgress = [
    shape(ui, timing.beats.primaryCopy),
    shape(ui, timing.beats.secondaryCopy),
  ];
  const copyPower = isMobileTiming ? COPY_SCRUB_POWER.mobile : COPY_SCRUB_POWER.desktop;

  const iconHidden = isMobileTiming
    ? headingProgress < SUPPORTING_UI_REVEAL
    : ui <= HIDDEN_EPSILON;

  return (
    <div className={styles.problem}>
      <div
        className={styles.title}
        style={{ "--problem-longest-line": LONGEST_LINE } as CSSProperties}
      >
        <Heading
          lines={HEADING}
          progress={headingProgress}
          motion={timing.headingMotion}
          className={styles.heading}
        />
      </div>

      <div className={`${styles.copy} section-reveal-paragraph`}>
        {PROBLEM.paragraphs.map((paragraph, i) => (
          <RevealText
            key={i}
            segments={paragraph}
            progress={copyProgress[i] ?? 0}
            duration={timing.copyDuration}
            progressPower={copyPower}
            offsetY="0.5em"
            offsetX="0em"
          />
        ))}
      </div>

      <IconPlus
        top={["10%", "5rem"]}
        left={["var(--offset-x)", "var(--offset-x-phone)"]}
        hidden={iconHidden}
      />
    </div>
  );
}
