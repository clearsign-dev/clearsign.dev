"use client";

import { useRef } from "react";
import { StepCard } from "@/components/getit/StepCard";
import { settledIndex, useStepStrip } from "@/components/getit/useStepStrip";
import { WarningPanel } from "@/components/getit/WarningPanel";
import { Heading } from "@/components/reveal/Heading";
import { IconPlus } from "@/components/reveal/IconPlus";
import type { SectionProps } from "@/components/stage/Stage";
import { GET_IT } from "@/lib/content";
import { beatProgress, clamp01 } from "@/lib/motion/progress";
import { GET_IT_TIMING, SUPPORTING_UI_REVEAL } from "@/lib/motion/timing";
import styles from "./GetIt.module.css";

// 6 — Get it. The heading holds the top of the right half; the three steps
// arrive as cards and cycle through as the visitor scrolls, with the download
// warning beside them the whole time they are on screen. Desktop: a strip
// along the bottom-left, the warning on the right. Mobile: the warning, then
// the steps stacked and crossfading, pinned to the bottom.
//
// Departures from the reference's Process section, which content needs: the
// heading stays up (no headingHide), and the cards show on desktop too.

const HIDDEN_EPSILON = 0.001;
const CARDS_VISIBLE = 0.05;

export function GetIt({ progress, isMobileTiming }: SectionProps) {
  const timing = isMobileTiming ? GET_IT_TIMING.mobile : GET_IT_TIMING.desktop;
  const section = clamp01(progress);
  const heading = beatProgress(section, timing.beats.headingReveal);
  const reveal = beatProgress(section, timing.beats.cardsReveal);
  const count = GET_IT.steps.length;
  const target = Math.max(0, count - 1) * beatProgress(section, timing.beats.cardsCycle);
  const plusHidden = isMobileTiming ? heading < SUPPORTING_UI_REVEAL : heading <= HIDDEN_EPSILON;
  const cardsHidden = reveal < CARDS_VISIBLE;

  const sliderRef = useRef<HTMLDivElement>(null);
  const { press, release } = useStepStrip(sliderRef, {
    target,
    smoothingMs: timing.cardsSmoothingMs,
    mobile: isMobileTiming,
  });
  const current = settledIndex(target, count);

  return (
    <div className={styles.getIt}>
      <div className={styles.content}>
        <Heading
          lines={[...GET_IT.heading]}
          progress={heading}
          motion={timing.headingMotion}
          className={`mobile-padded ${styles.heading}`}
        />
        <IconPlus top={["0", "4.6rem"]} left="0" desktopHide hidden={plusHidden} />
      </div>

      <div className={styles.cards} aria-hidden={cardsHidden} inert={cardsHidden}>
        <WarningPanel warning={GET_IT.warning} revealProgress={reveal} className={styles.warning} />

        <div className={styles.viewport}>
          <div ref={sliderRef} className={styles.slider}>
            {GET_IT.steps.map((step, i) => {
              // Covered by the next card on desktop; faded out on mobile.
              const away = isMobileTiming ? i !== current : i + 1 <= target + HIDDEN_EPSILON;
              const live = !cardsHidden && !away;
              return (
                <div
                  key={step.title}
                  className={styles.slot}
                  data-step-slot
                  data-live={live || undefined}
                  role="group"
                  aria-label={step.title}
                  inert={!live}
                  onPointerDown={() => press(i)}
                  onPointerUp={release}
                  onPointerCancel={release}
                  onPointerLeave={release}
                >
                  <StepCard
                    step={step}
                    index={i}
                    total={count}
                    timing={timing.cardItems}
                    revealProgress={reveal}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
