"use client";

import Link from "next/link";
import { useEffect, useState, type MouseEvent, type PointerEvent } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { Button } from "@/components/ui/Button";
import { playSfx } from "@/lib/audio/sfx";
import { HEADER } from "@/lib/content";
import { HERO_INTRO_PHASE, HERO_INTRO_PHASE_MOBILE } from "@/lib/motion/timing";
import { introPhase } from "@/lib/stage/intro";
import { SECTION_INDEX } from "@/lib/stage/sections";
import { menuOpen, preloader, stageProgress, useStore } from "@/lib/stage/store";
import { useLayoutFlags } from "@/lib/stage/useLayoutFlags";
import { aimFill } from "./header/fill";
import { GridGlyph } from "./header/icons";
import { MENU_ID, menuPhase } from "./header/menuState";
import { navigateToSection } from "./header/navigate";
import { useResonance } from "./header/useResonance";
import styles from "./Header.module.css";

// The logo top-left, and the two upright tabs top-right: the dark "Menu" tab
// and the accent CTA. Phones swap both tabs for one round menu trigger.
// Everything waits for the intro: logo first, the tabs a beat later.

const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

// The logo tucks away while the page scrolls down and returns on the way up.
function useTuckedOnScrollDown() {
  const [tucked, setTucked] = useState(false);
  useEffect(() => {
    let last = stageProgress.get().global;
    return stageProgress.subscribe(() => {
      const current = stageProgress.get().global;
      setTucked(current > last && current > 0.01);
      last = current;
    });
  }, []);
  return tucked;
}

const toggleMenu = () => menuOpen.set((open) => !open);

function pressGlyph(event: PointerEvent<HTMLButtonElement>, pressed: boolean) {
  if (pressed) event.currentTarget.dataset.pressed = "true";
  else delete event.currentTarget.dataset.pressed;
}

export function Header() {
  const phase = useStore(introPhase);
  const open = useStore(menuOpen);
  const panel = useStore(menuPhase);
  const settled = useStore(preloader, (p) => p.leaving || !p.visible);
  const { isMobile } = useLayoutFlags();
  const tucked = useTuckedOnScrollDown();
  const [tabRef, resonance] = useResonance<HTMLButtonElement>();

  const logoRevealed = phase >= HERO_INTRO_PHASE.logo;
  const tabsRevealed = isMobile
    ? phase >= HERO_INTRO_PHASE_MOBILE.buttons
    : phase >= HERO_INTRO_PHASE.menuButtons;
  const triggerRevealed = tabsRevealed && !open && panel === "closed";
  const menuShowing = open || panel !== "closed";

  const onLogoClick = (event: MouseEvent<HTMLAnchorElement>) => {
    // Off the stage (privacy, 404) the link simply goes home.
    if (!document.getElementById("stage-scroll-wrapper")) return;
    event.preventDefault();
    void navigateToSection(0);
  };

  const onTabEnter = (event: MouseEvent<HTMLButtonElement>) => {
    aimFill(event.currentTarget, event.clientX, event.clientY);
    playSfx("hover");
  };

  const onTabLeave = (event: MouseEvent<HTMLButtonElement>) => {
    aimFill(event.currentTarget, event.clientX, event.clientY);
  };

  return (
    <>
      <Link
        href="/"
        className={cx(
          styles.logo,
          logoRevealed && styles.logoRevealed,
          tucked && styles.logoTucked,
          menuShowing && styles.logoOnLight,
        )}
        aria-label="ClearSign, back to the start"
        inert={!logoRevealed}
        onClick={onLogoClick}
      >
        <Wordmark height={52} className={styles.wordmark} />
      </Link>

      <header className={cx(styles.header, settled && styles.noDelay)}>
        <div className={styles.tabs}>
          <button
            ref={tabRef}
            type="button"
            className={cx(styles.tab, tabsRevealed && styles.revealed)}
            aria-controls={MENU_ID}
            aria-expanded={open}
            aria-haspopup="dialog"
            data-cursor-label={HEADER.menu}
            inert={!tabsRevealed}
            onClick={toggleMenu}
            onMouseEnter={onTabEnter}
            onMouseLeave={onTabLeave}
            {...resonance}
          >
            <span className={styles.tabBg} aria-hidden="true" />
            <span className={styles.fillWrap} aria-hidden="true">
              <span className={styles.fill} />
            </span>
            <span className={styles.tabContent}>
              <span className={styles.tabLabel}>{HEADER.menu}</span>
              <GridGlyph className={styles.tabGlyph} />
            </span>
          </button>
          <span className={styles.ctaSlot} inert={!tabsRevealed}>
            <Button
              vertical
              revealed={tabsRevealed}
              variant="accent"
              showIcon
              label={HEADER.cta}
              cursorLabel={HEADER.cta}
              onClick={() => void navigateToSection(SECTION_INDEX.getIt)}
            />
          </span>
        </div>
      </header>

      <button
        type="button"
        className={cx(styles.trigger, triggerRevealed && styles.triggerRevealed, settled && styles.noDelay)}
        aria-label={HEADER.menu}
        aria-controls={MENU_ID}
        aria-expanded={open}
        aria-haspopup="dialog"
        inert={!tabsRevealed}
        onClick={toggleMenu}
        onPointerDown={(event) => pressGlyph(event, true)}
        onPointerUp={(event) => pressGlyph(event, false)}
        onPointerCancel={(event) => pressGlyph(event, false)}
        onPointerLeave={(event) => pressGlyph(event, false)}
      >
        <span className={styles.triggerFillWrap} aria-hidden="true">
          <span className={styles.triggerFill} />
        </span>
        <span className={styles.triggerContent}>
          <GridGlyph className={styles.triggerGlyph} />
        </span>
      </button>
    </>
  );
}
