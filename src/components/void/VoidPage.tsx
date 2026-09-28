"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { VoidHero } from "@/components/game/VoidHero";
import { NOT_FOUND } from "@/lib/content";
import { prefersReducedMotion } from "@/lib/motion/easings";
import { Aperture } from "./Aperture";
import { IdleHint, KonamiHint } from "./Hints";
import { TickRuler } from "./TickRuler";
import { useIdleHint } from "./useIdleHint";
import { useKonami } from "./useKonami";
import { usePointerDrift } from "./usePointerDrift";
import { VoidScene } from "./VoidScene";
import styles from "./VoidPage.module.css";

// The 404: a dark room with "4 ◯ 4" standing in it, where the middle zero is
// ClearSign's aperture with a light inside. The dot at its centre, the
// "Go home" line and the wordmark all lead home, by way of a rush into the
// light. Idle for a while and the page asks whether you are still there; the
// Konami code opens the game.

const NAVIGATE_AFTER_MS = 1800;
const PHONE_QUERY = "(max-width: 767px)";

// One sentence per line, as the reference sets its tagline.
const BODY_LINES = NOT_FOUND.body
  .split(". ")
  .map((sentence, i, all) => (i < all.length - 1 ? `${sentence}.` : sentence));

const isModified = (event: MouseEvent) =>
  event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

export function VoidPage() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);

  usePointerDrift(rootRef);

  const live = !gameOpen && !leaving;
  const { shown: idleShown, dismiss: dismissIdle } = useIdleHint(live);

  const openGame = useCallback(() => {
    dismissIdle();
    setGameOpen(true);
  }, [dismissIdle]);

  const { index, press, reset } = useKonami({ enabled: live, onComplete: openGame });

  const closeGame = useCallback(() => {
    reset();
    setGameOpen(false);
  }, [reset]);

  const onIdleKey = useCallback(() => {
    dismissIdle();
    // Phones have no arrow keys: the reference's phone hint goes straight to the game.
    if (window.matchMedia(PHONE_QUERY).matches) openGame();
    else press("ArrowUp");
  }, [dismissIdle, openGame, press]);

  const goHome = useCallback(
    (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented || isModified(event)) return;
      event.preventDefault();
      if (leaving) return;
      if (prefersReducedMotion()) {
        router.push("/");
        return;
      }
      setLeaving(true);
    },
    [leaving, router],
  );

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => router.push("/"), NAVIGATE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, router]);

  const lean = {
    onPointerEnter: () => setHover(true),
    onPointerLeave: () => setHover(false),
  };

  return (
    <div
      ref={rootRef}
      className={styles.page}
      data-leaving={leaving || undefined}
      data-playing={gameOpen || undefined}
    >
      <VoidScene hover={hover && !leaving} leaving={leaving} paused={gameOpen} />

      <h1 className={styles.heading}>
        <span className="sr-only">
          {NOT_FOUND.code} — {NOT_FOUND.title}
        </span>
        <span className={styles.digits} aria-hidden="true">
          <span className={`${styles.four} ${styles.fourLeft}`}>{NOT_FOUND.code[0]}</span>
          <span className={styles.slot}>
            <Aperture hover={hover && !leaving}>
              <Link
                href="/"
                className={styles.dot}
                onClick={goHome}
                tabIndex={-1}
                aria-hidden="true"
                {...lean}
              />
            </Aperture>
          </span>
          <span className={`${styles.four} ${styles.fourRight}`}>{NOT_FOUND.code[2]}</span>
        </span>
      </h1>

      <Link
        href="/"
        className={`${styles.cta} ${styles.ui} ${styles.fadeWhilePlaying}`}
        onClick={goHome}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        {...lean}
      >
        <span className={styles.ctaLabel}>{NOT_FOUND.back}</span>
        <span className={styles.ctaNote}>{NOT_FOUND.backNote}</span>
      </Link>

      <Link href="/" className={`${styles.logo} ${styles.ui}`} onClick={goHome}>
        <Wordmark height={38} />
      </Link>

      <TickRuler className={`${styles.ui} ${styles.rulerIn}`} />

      <div className={`${styles.tracker} ${styles.ui}`}>
        <span>{NOT_FOUND.tracker[0]}</span>
        <span className={styles.diamond} aria-hidden="true">
          ◆
        </span>
        <span>{NOT_FOUND.tracker[1]}</span>
      </div>

      <p className={`${styles.tagline} ${styles.ui} ${styles.fadeWhilePlaying}`}>
        <span>
          {NOT_FOUND.code} — {NOT_FOUND.title}.
        </span>
        {BODY_LINES.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>

      {live && idleShown && index === 0 ? <IdleHint onKey={onIdleKey} /> : null}
      {live && index >= 1 ? <KonamiHint index={index} onPress={press} /> : null}

      {leaving ? (
        <>
          <div className={styles.flash} aria-hidden="true" />
          <div className={styles.blackout} aria-hidden="true" />
        </>
      ) : null}

      <VoidHero open={gameOpen} onClose={closeGame} />
    </div>
  );
}
