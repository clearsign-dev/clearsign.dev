"use client";

import { useRef, useState } from "react";
import { EvidenceTrain } from "@/components/evidence/EvidenceTrain";
import { SlideFocusBadge } from "@/components/evidence/SlideFocusBadge";
import { Heading } from "@/components/reveal/Heading";
import { IconPlus } from "@/components/reveal/IconPlus";
import { RevealText } from "@/components/reveal/RevealText";
import type { SectionProps } from "@/components/stage/Stage";
import { EVIDENCE } from "@/lib/content";
import { beatProgress, clamp01, uiProgress } from "@/lib/motion/progress";
import { EVIDENCE_TIMING, SUPPORTING_UI_REVEAL } from "@/lib/motion/timing";
import styles from "./Evidence.module.css";

// 4 — The evidence. Anatomy: the reference's Blog section. The heading sits at
// the bottom, a short description top-left, and between them a train of
// evidence cards that scroll carries from the first to the last.

const HIDDEN_EPSILON = 0.001;
// How far the description rises as it reveals.
const CONTENT_RISE_PX = 30;
// The reference's scrub power for this paragraph: the first words wait a little.
const COPY_PROGRESS_POWER = 1.18;

const HEADING_LINES = [...EVIDENCE.heading];
const CAROUSEL_LABEL = EVIDENCE.heading.join(" ");

export function Evidence({ progress, isMobileTiming }: SectionProps) {
  const timing = isMobileTiming ? EVIDENCE_TIMING.mobile : EVIDENCE_TIMING.desktop;
  const wrapRef = useRef<HTMLDivElement>(null);
  const descRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [trainVisible, setTrainVisible] = useState(false);

  const sectionProgress = clamp01(progress);
  const ui = uiProgress(progress, timing.window);
  const descriptionOut = uiProgress(progress, {
    ...timing.window,
    hideStart: timing.descriptionHide.start,
    hideEnd: timing.descriptionHide.end,
  });
  const contentUi = beatProgress(sectionProgress, timing.content) * descriptionOut;
  const iconHidden = isMobileTiming ? ui < SUPPORTING_UI_REVEAL : ui <= HIDDEN_EPSILON;

  return (
    <>
      <EvidenceTrain
        progress={progress}
        slides={timing.slides}
        entryStart={timing.window.revealStart}
        exitEnd={timing.window.hideEnd}
        isMobileTiming={isMobileTiming}
        label={CAROUSEL_LABEL}
        focusedIndex={focusedIndex}
        onFocusChange={setFocusedIndex}
        onVisibleChange={setTrainVisible}
        wrapRef={wrapRef}
        descRef={descRef}
      />
      <div ref={wrapRef} className={styles.wrap}>
        <Heading
          lines={HEADING_LINES}
          position="bottom"
          progress={ui}
          motion={timing.headingMotion}
          className="mobile-padded"
        />

        <IconPlus bottom="3.35rem" left="0" desktopHide hidden={iconHidden} />

        <div
          ref={descRef}
          className={styles.desc}
          style={{ transform: `translate3d(0, ${((1 - contentUi) * CONTENT_RISE_PX).toFixed(2)}px, 0)` }}
        >
          <RevealText
            segments={EVIDENCE.description}
            progress={contentUi}
            duration={timing.copyDuration}
            progressPower={COPY_PROGRESS_POWER}
            className="section-reveal-paragraph"
          />
          {isMobileTiming ? (
            <SlideFocusBadge
              slides={EVIDENCE.slides}
              index={focusedIndex}
              visible={trainVisible}
              reveal={contentUi}
            />
          ) : null}
        </div>
      </div>
    </>
  );
}
