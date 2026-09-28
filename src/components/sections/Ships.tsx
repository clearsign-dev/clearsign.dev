"use client";

import { useRef } from "react";
import { Heading } from "@/components/reveal/Heading";
import { IconPlus } from "@/components/reveal/IconPlus";
import { RevealText } from "@/components/reveal/RevealText";
import { ShipCard } from "@/components/ships/ShipCard";
import { useShipsColumn } from "@/components/ships/useShipsColumn";
import type { SectionProps } from "@/components/stage/Stage";
import { SHIPS } from "@/lib/content";
import { beatProgress, clamp01, uiProgress } from "@/lib/motion/progress";
import { SHIPS_TIMING, SUPPORTING_UI_REVEAL } from "@/lib/motion/timing";
import styles from "./Ships.module.css";

// 5 — How it ships. A column of cards on the left travels up past the
// viewport while the heading holds the bottom of the right half and a single
// line of copy sits under a divider that draws in from the right. On mobile
// the column becomes a row that travels sideways.

const HIDDEN_EPSILON = 0.001;
const PARAGRAPH_PROGRESS_POWER = 1.25;

export function Ships({ progress, isMobileTiming }: SectionProps) {
  const timing = isMobileTiming ? SHIPS_TIMING.mobile : SHIPS_TIMING.desktop;
  const section = clamp01(progress);
  const ui = uiProgress(section, timing.window);
  const heading = beatProgress(ui, timing.beats.heading);
  const paragraph = beatProgress(ui, timing.beats.paragraph);
  const divider = beatProgress(ui, timing.beats.divider);
  const cardsReveal = beatProgress(section, timing.beats.cardsReveal);
  const cardsMove = beatProgress(section, timing.beats.cardsMove);
  const plusHidden = isMobileTiming ? paragraph < SUPPORTING_UI_REVEAL : ui <= HIDDEN_EPSILON;

  const columnRef = useRef<HTMLDivElement>(null);
  useShipsColumn(columnRef, {
    reveal: cardsReveal,
    move: cardsMove,
    smoothingMs: timing.cardsSmoothingMs,
    mobile: isMobileTiming,
    itemTiming: timing.cardItems,
  });

  return (
    <>
      <div className={styles.ships}>
        <Heading
          lines={[...SHIPS.heading]}
          sup={SHIPS.sup}
          position="bottom"
          progress={heading}
          motion={timing.headingMotion}
          className={styles.heading}
        />

        <div className={styles.desc}>
          <div
            className={styles.copy}
            style={
              isMobileTiming
                ? { transform: `translate3d(0, ${((1 - paragraph) * 24).toFixed(2)}px, 0)` }
                : undefined
            }
          >
            <RevealText
              segments={SHIPS.paragraph}
              progress={paragraph}
              duration={timing.copyDuration}
              progressPower={PARAGRAPH_PROGRESS_POWER}
              className={`section-reveal-paragraph ${styles.paragraph}`}
            />
          </div>
          <div
            className={styles.divider}
            style={{ opacity: divider, transform: `scale3d(${divider}, 1, 1)` }}
            aria-hidden="true"
          />
          <IconPlus top={["1rem", "0.2rem"]} left="0" hidden={plusHidden} className={styles.plus} />
        </div>
      </div>

      <div ref={columnRef} className={styles.cards}>
        {SHIPS.cards.map((card) => (
          <ShipCard key={card.id} card={card} total={SHIPS.cards.length} />
        ))}
      </div>
    </>
  );
}
