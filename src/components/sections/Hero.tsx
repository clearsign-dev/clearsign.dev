"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { Heading } from "@/components/reveal/Heading";
import { IconPlus } from "@/components/reveal/IconPlus";
import { RevealText } from "@/components/reveal/RevealText";
import type { SectionProps } from "@/components/stage/Stage";
import { HERO } from "@/lib/content";
import { EASE, prefersReducedMotion } from "@/lib/motion/easings";
import { beatProgress, clamp01, smoothstep } from "@/lib/motion/progress";
import {
  HERO_INTRO_PHASE,
  HERO_INTRO_PHASE_MOBILE,
  HERO_TIMING,
  SUPPORTING_UI_REVEAL,
} from "@/lib/motion/timing";
import { introPhase } from "@/lib/stage/intro";
import { canScroll, createStore, useStore } from "@/lib/stage/store";
import styles from "./Hero.module.css";

// The opening screen: a meta row over a three-line headline. Before scrolling
// unlocks, each part plays in real time as the intro reaches its phase; after
// that, everything is a function of scroll and leaves as the visitor moves on.

const HEADLINE = [...HERO.heading];
const LONGEST_LINE = Math.max(...HEADLINE.map((line) => line.length));

// Under this the hero counts as scrolled away (the markers hide with it).
const HIDDEN_EPSILON = 0.001;
const PRIMARY_SCRUB_POWER = 1.25;
const HEADING_SCRUB_POWER = 1.12;

// The headline unlocks scrolling a moment before its last letters land.
const UNLOCK_SCROLL = {
  offset: HERO_TIMING.unlockBeforeHeadingEnd,
  callback: () => canScroll.set(true),
};

const CLOCK_REFRESH_MS = 10_000;
// Shown until the first client tick, so static HTML never carries a stale time.
const CLOCK_PLACEHOLDER = "--:--";
const utcClock = createStore(CLOCK_PLACEHOLDER);

const pad2 = (value: number) => String(value).padStart(2, "0");

function readUtcClock(): string {
  const now = new Date();
  return `${pad2(now.getUTCHours())}:${pad2(now.getUTCMinutes())}`;
}

// Fully shown for the first part of the section, then eased out to 0 by its end.
function heroUiProgress(sectionProgress: number): number {
  const p = clamp01(sectionProgress);
  const hold = HERO_TIMING.scrollHoldEnd;
  if (p <= hold) return 1;
  return 1 - smoothstep((p - hold) / (1 - hold));
}

const ruleTransform = (scale: number) => `translate3d(-50%, 0, 0) scaleX(${clamp01(scale)})`;

type RevealDrive = { progress: number; progressPower: number } | { visible: boolean };

export function Hero({ progress, isMobileTiming }: SectionProps) {
  const phase = useStore(introPhase);
  // Keyed off the global unlock, not local state: the hero unmounts two
  // sections down, and a fresh mount must scrub at once, never replay the intro.
  const scrub = useStore(canScroll);
  const clock = useStore(utcClock);
  const ruleRef = useRef<HTMLSpanElement>(null);

  const phases = isMobileTiming ? HERO_INTRO_PHASE_MOBILE : HERO_INTRO_PHASE;
  const primaryOn = phase >= phases.primaryText;
  const secondaryOn = phase >= phases.secondaryText;
  const headingOn = phase >= phases.heading;

  const ui = heroUiProgress(progress);
  const secondaryScroll = beatProgress(ui, HERO_TIMING.scrollBeats.secondaryText);
  const headingScroll = beatProgress(ui, HERO_TIMING.scrollBeats.heading);

  const iconsHidden =
    !scrub || (isMobileTiming ? headingScroll < SUPPORTING_UI_REVEAL : ui <= HIDDEN_EPSILON);

  const primary: RevealDrive = scrub
    ? { progress: ui, progressPower: PRIMARY_SCRUB_POWER }
    : { visible: primaryOn };
  const secondary: RevealDrive = scrub
    ? { progress: secondaryScroll, progressPower: PRIMARY_SCRUB_POWER }
    : { visible: secondaryOn };
  const heading = scrub
    ? { progress: headingScroll ** HEADING_SCRUB_POWER }
    : { visible: headingOn };

  useEffect(() => {
    const tick = () => utcClock.set(readUtcClock());
    tick();
    const timer = window.setInterval(tick, CLOCK_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);

  // The hairline under the meta row grows from the centre when the intro
  // reaches the meta text. In scrub mode its inline transform (below) rules.
  const ruleIntro = !scrub && primaryOn;
  useEffect(() => {
    const rule = ruleRef.current;
    if (!rule || !ruleIntro) return;
    const grow = rule.animate(
      [{ transform: ruleTransform(0) }, { transform: ruleTransform(1) }],
      {
        duration: prefersReducedMotion() ? 0 : HERO_TIMING.topLineDurationMs,
        easing: EASE.power2Out,
        fill: "both",
      },
    );
    return () => grow.cancel();
  }, [ruleIntro]);

  return (
    <div
      className={styles.hero}
      style={{ "--hero-longest-line": LONGEST_LINE } as CSSProperties}
    >
      <div className={styles.meta}>
        <div className={`${styles.group} ${styles.leading}`}>
          <RevealText
            segments={HERO.metaPrimary}
            duration={HERO_TIMING.textDuration}
            className={styles.item}
            {...primary}
          />
          <RevealText
            segments={HERO.metaSecondary}
            duration={HERO_TIMING.textDuration}
            className={styles.item}
            {...secondary}
          />
        </div>

        <div className={styles.group}>
          <RevealText
            segments={HERO.metaTertiary}
            duration={HERO_TIMING.textDuration}
            className={styles.item}
            {...primary}
          />
          <p className={`${styles.item} ${styles.clock}`}>
            {/* The time rises as one block, as on the reference. */}
            <RevealText
              as="span"
              segments={clock}
              split={false}
              duration={HERO_TIMING.textDuration}
              className={styles.time}
              {...secondary}
            />
            <RevealText
              as="span"
              segments={HERO.clockLabel}
              duration={HERO_TIMING.textDuration}
              {...secondary}
            />
          </p>
        </div>

        <span
          ref={ruleRef}
          className={styles.rule}
          style={{ transform: ruleTransform(scrub ? ui : 0) }}
          aria-hidden="true"
        />
      </div>

      <Heading
        as="h1"
        lines={HEADLINE}
        motion={HERO_TIMING.headingMotion}
        onBeforeEnd={UNLOCK_SCROLL}
        className={styles.headline}
        lineClassName={styles.line}
        {...heading}
      />

      <IconPlus top="43%" right="20px" hidden={iconsHidden} className={styles.iconRight} />
      <IconPlus top="65%" left="20px" hidden={iconsHidden} className={styles.iconLeft} />
    </div>
  );
}
