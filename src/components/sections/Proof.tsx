"use client";

import type { CSSProperties } from "react";
import { RecordPanel } from "@/components/proof/RecordPanel";
import { Heading } from "@/components/reveal/Heading";
import { IconPlus } from "@/components/reveal/IconPlus";
import { RevealText } from "@/components/reveal/RevealText";
import type { Segment } from "@/components/reveal/SplitText";
import type { SectionProps } from "@/components/stage/Stage";
import { Button } from "@/components/ui/Button";
import { PROOF } from "@/lib/content";
import { beat, beatProgress, clamp01, uiProgress } from "@/lib/motion/progress";
import { PROOF_TIMING, SUPPORTING_UI_REVEAL } from "@/lib/motion/timing";
import styles from "./Proof.module.css";

// Proof. An inverted heading top-left with the call to action under it, the
// record ClearSign read beneath them, and one large statement at the bottom
// right whose verdict is lit. The UI keeps fading out across the opening of
// the next section (a holdover).

const HEADING = [...PROOF.heading];
const STATEMENT: Segment[] = PROOF.statement.map((part) =>
  typeof part === "string" ? part : { text: part.text, className: styles.highlight },
);

const HIDDEN_EPSILON = 0.001;
const HEADING_RISE_PX = 20;
const SUBTITLE_SCRUB_POWER = 1.12;
// The record follows the button's beat by this much of the UI progress.
const RECORD_LAG = 0.06;

function Cta({ progress, className }: { progress: number; className: string }) {
  return (
    <div
      className={`${styles.cta} ${className}`}
      style={{
        clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`,
        opacity: progress,
        transform: `scaleX(${progress})`,
        visibility: progress > HIDDEN_EPSILON ? "visible" : "hidden",
      }}
    >
      <Button label={PROOF.cta} href={PROOF.ctaHref} cursorLabel="Proceed" />
    </div>
  );
}

export function Proof({ progress, isMobileTiming, isPhoneTiming }: SectionProps) {
  const timing = isPhoneTiming
    ? PROOF_TIMING.phone
    : isMobileTiming
      ? PROOF_TIMING.mobile
      : PROOF_TIMING.desktop;

  // Raw progress: past 1 while the next section opens. The reference derives
  // its desktop exit from a shader; with no such input here, every layout uses
  // its window-based (mobile) exit.
  const ui = uiProgress(progress, timing.window);
  const scrim =
    beatProgress(clamp01(progress), timing.beats.scrimIn) *
    (1 - beatProgress(progress, timing.beats.scrimOut));

  const headingProgress = beatProgress(ui, timing.beats.heading);
  const subtitleProgress = beatProgress(ui, timing.beats.subtitle);
  const buttonBeat = timing.beats.button;
  const buttonProgress = beatProgress(ui, buttonBeat);
  const recordProgress = beatProgress(
    ui,
    beat(buttonBeat.start + RECORD_LAG, buttonBeat.end - buttonBeat.start),
  );

  const iconHidden = isMobileTiming
    ? headingProgress < SUPPORTING_UI_REVEAL
    : ui <= HIDDEN_EPSILON;

  return (
    <div className={styles.proof} style={{ "--scrim-opacity": scrim } as CSSProperties}>
      <div className={styles.top}>
        <div className={styles.wrap}>
          <div
            className={styles.headingWrap}
            style={{
              transform: `translate3d(0, ${(1 - headingProgress) * HEADING_RISE_PX}px, 0)`,
            }}
          >
            <Heading
              lines={HEADING}
              progress={headingProgress}
              motion={timing.headingMotion}
              inverted
              className="mobile-padded"
              lineClassName={styles.headingLine}
            />
          </div>

          <IconPlus top="0" left="0" desktopHide hidden={iconHidden} />

          {/* Under the heading on desktop and tablet; phones get the copy below. */}
          <Cta progress={buttonProgress} className={styles.ctaTop} />
        </div>

        <RecordPanel progress={recordProgress} />
      </div>

      <div className={styles.footer}>
        <RevealText
          segments={STATEMENT}
          progress={subtitleProgress}
          duration={timing.subtitleDuration}
          progressPower={SUBTITLE_SCRUB_POWER}
          className={styles.statement}
        />
        {/* Phones: the CTA shares the bottom group with the statement. */}
        <Cta progress={buttonProgress} className={styles.ctaBottom} />
      </div>
    </div>
  );
}
