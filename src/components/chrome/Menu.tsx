"use client";

import { useEffect, useRef, type KeyboardEvent, type MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import { playSfx } from "@/lib/audio/sfx";
import { CONTACT, HEADER, MENU, SOCIALS } from "@/lib/content";
import { EASE, prefersReducedMotion } from "@/lib/motion/easings";
import { SECTIONS, SECTION_INDEX } from "@/lib/stage/sections";
import { menuOpen, useStore } from "@/lib/stage/store";
import { aimFill } from "./header/fill";
import { ArrowGlyph, BranchGlyph, CrossGlyph } from "./header/icons";
import { MENU_ID, menuPhase } from "./header/menuState";
import { navigateToSection } from "./header/navigate";
import { Sequence } from "./header/sequence";
import styles from "./Menu.module.css";

// The site menu: a white panel that drops from the top-right corner (the
// whole screen on phones) with the six story sections, a contact button, a
// note and the social tiles. Opens from the `menuOpen` store.

const ITEMS = SECTIONS.slice(1, 7);

const EASE_OUT = EASE.outQuart;
const EASE_IN = EASE.power2In;
const EASE_RULE = "cubic-bezier(0.25, 0.46, 0.45, 0.94)";
const CLOSE_SPEED = 1.25;

// Keys the stage uses to move between sections; inside the menu they belong
// to the menu.
const STAGE_KEYS = new Set(["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "]);

const SOCIAL_GLYPHS = { github: BranchGlyph } as const;

function buildSequence(root: HTMLElement): Sequence {
  const q = (selector: string) => root.querySelectorAll(selector);
  const one = (selector: string) => root.querySelector(selector);
  const out = { easing: EASE_OUT, reverseEasing: EASE_IN };
  // The items' reveal curve is a linear() easing; older engines reject it.
  const reveal = CSS.supports("animation-timing-function", "linear(0, 1)") ? EASE.customReveal : EASE.expoOut;
  return new Sequence()
    .add(root, [{ transform: "translate3d(0, -104%, 0)" }, { transform: "translate3d(0, 0%, 0)" }], {
      ...out,
      duration: 860,
    })
    .add(q("[data-menu-sheet]"), [{ transform: "translate3d(0, -1.4rem, 0)" }, { transform: "translate3d(0, 0, 0)" }], {
      ...out,
      duration: 680,
      stagger: 36,
    })
    .add(
      one("[data-menu-close]"),
      [
        { transform: "translate3d(0, -1rem, 0) rotate(-45deg) scale(0.82)", opacity: 0 },
        { transform: "translate3d(0, 0, 0) rotate(0deg) scale(1)", opacity: 1 },
      ],
      { ...out, duration: 560, start: 110 },
    )
    .add(
      q("[data-menu-item]"),
      [
        { transform: "translate3d(0, 115%, 0) rotate(2deg)", opacity: 0.2 },
        { transform: "translate3d(0, 0%, 0) rotate(0deg)", opacity: 1 },
      ],
      { easing: reveal, reverseEasing: EASE_IN, duration: 620, start: 150, stagger: 44 },
    )
    .add(
      one("[data-menu-cta]"),
      [
        { opacity: 0, transform: "translate3d(0, 1rem, 0) scale(0.985)" },
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
      ],
      { ...out, duration: 520, start: 390 },
    )
    .add(one("[data-menu-rule]"), [{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
      easing: EASE_RULE,
      reverseEasing: EASE_IN,
      duration: 460,
      start: 450,
    })
    .add(
      one("[data-menu-note]"),
      [
        { opacity: 0, transform: "translate3d(0, 0.8rem, 0)" },
        { opacity: 1, transform: "translate3d(0, 0, 0)" },
      ],
      { ...out, duration: 480, start: 480 },
    )
    .add(
      q("[data-menu-social]"),
      [
        { opacity: 0, transform: "translate3d(0, 0.7rem, 0) scale(0.94)" },
        { opacity: 1, transform: "translate3d(0, 0, 0) scale(1)" },
      ],
      { ...out, duration: 420, start: 520, stagger: 28 },
    );
}

const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function visibleTrigger(): HTMLElement | null {
  const triggers = document.querySelectorAll<HTMLElement>(`[aria-controls="${MENU_ID}"]`);
  return Array.from(triggers).find((el) => el.getClientRects().length > 0 && !el.closest("[inert]")) ?? null;
}

const closeMenu = () => menuOpen.set(false);

export function Menu() {
  const open = useStore(menuOpen);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const sequenceRef = useRef<Sequence | null>(null);
  const wasOpenRef = useRef(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  // Build the open/close sequence once; it holds every target at its closed pose.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const sequence = buildSequence(root);
    sequence.onReverseComplete = () => menuPhase.set("closed");
    sequenceRef.current = sequence;
    return () => {
      sequence.destroy();
      sequenceRef.current = null;
    };
  }, []);

  // Play or rewind on every change of `menuOpen`, and move focus.
  useEffect(() => {
    if (open === wasOpenRef.current) return;
    wasOpenRef.current = open;
    const sequence = sequenceRef.current;
    const instant = prefersReducedMotion() || !sequence;

    if (open) {
      const active = document.activeElement;
      returnFocusRef.current = active instanceof HTMLElement && active !== document.body ? active : null;
      menuPhase.set("open");
      if (instant) sequence?.seek(1);
      else {
        sequence.speed = 1;
        sequence.play();
      }
      queueMicrotask(() => closeRef.current?.focus({ preventScroll: true }));
      return;
    }

    menuPhase.set("closing");
    if (instant) {
      sequence?.seek(0);
      menuPhase.set("closed");
    } else {
      sequence.speed = CLOSE_SPEED;
      sequence.reverse();
    }

    // Hand focus back only if it was in the menu (or dropped to the body);
    // never pull it away from something the visitor has just chosen.
    const root = rootRef.current;
    const active = document.activeElement;
    if (active && active !== document.body && !root?.contains(active)) return;
    const remembered = returnFocusRef.current;
    const target =
      remembered && remembered.isConnected && !root?.contains(remembered) && remembered.getClientRects().length > 0
        ? remembered
        : visibleTrigger();
    target?.focus({ preventScroll: true });
  }, [open]);

  // While open: Escape closes, and a press anywhere outside the panel closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      closeMenu();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node) || rootRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest(`[aria-controls="${MENU_ID}"]`)) return;
      closeMenu();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [open]);

  // Keep Tab inside the panel, and keep the stage's navigation keys out of it.
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (STAGE_KEYS.has(event.key)) event.stopPropagation();
    if (event.key !== "Tab" || !rootRef.current) return;
    const focusable = Array.from(rootRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const go = (index: number) => {
    void navigateToSection(index);
    closeMenu();
  };

  const onItemClick = (event: MouseEvent<HTMLAnchorElement>, index: number) => {
    event.preventDefault();
    go(index);
  };

  // The pill's fill follows the pointer in and out.
  const onItemPointer = (event: MouseEvent<HTMLElement>) => {
    aimFill(event.currentTarget.querySelector("[data-pill]"), event.clientX, event.clientY);
  };

  const onTileEnter = (event: MouseEvent<HTMLElement>) => {
    aimFill(event.currentTarget, event.clientX, event.clientY);
    playSfx("hover");
  };

  const onTileLeave = (event: MouseEvent<HTMLElement>) => {
    aimFill(event.currentTarget, event.clientX, event.clientY);
  };

  return (
    <div
      ref={rootRef}
      id={MENU_ID}
      className={styles.menu}
      role="dialog"
      aria-modal="true"
      aria-label="Site navigation"
      aria-hidden={!open}
      inert={!open}
      onKeyDown={onKeyDown}
    >
      <div data-menu-sheet="" className={`${styles.sheet} ${styles.sheetAccent}`} />
      <div data-menu-sheet="" className={`${styles.sheet} ${styles.sheetDark}`} />
      <div data-menu-sheet="" className={styles.sheet} />

      <button
        ref={closeRef}
        type="button"
        data-menu-close=""
        className={styles.close}
        aria-label="Close menu"
        data-cursor-label={HEADER.close}
        onClick={closeMenu}
        onMouseEnter={() => playSfx("hover")}
      >
        <CrossGlyph className={styles.closeGlyph} />
      </button>

      <div className={styles.wrap}>
        <nav className={styles.nav} aria-label="Sections">
          {ITEMS.map((section) => (
            <a
              key={section.id}
              href={`#section-${section.index}`}
              className={styles.link}
              data-cursor-hide=""
              onClick={(event) => onItemClick(event, section.index)}
              onMouseEnter={(event) => {
                onItemPointer(event);
                playSfx("hover");
              }}
              onMouseLeave={onItemPointer}
            >
              <span data-menu-item="" className={styles.inner}>
                <span className={styles.arrow} aria-hidden="true">
                  <ArrowGlyph className={styles.arrowGlyph} />
                </span>
                <span data-pill="" className={styles.pill}>
                  <span className={styles.pillFillWrap} aria-hidden="true">
                    <span className={styles.pillFill} />
                  </span>
                  <span className={styles.pillLabel}>
                    <span className={styles.text}>{section.indicatorLabel}</span>
                  </span>
                </span>
              </span>
            </a>
          ))}
        </nav>

        <div data-menu-cta="" className={styles.cta}>
          <Button
            variant="accent"
            label={MENU.contact}
            className={styles.ctaButton}
            cursorLabel={CONTACT.submit}
            onClick={() => go(SECTION_INDEX.contact)}
          />
        </div>

        <div data-menu-rule="" className={styles.rule} aria-hidden="true" />

        <div data-menu-note="" className={styles.note}>
          <p>{MENU.note}</p>
        </div>

        <div className={styles.socials}>
          {SOCIALS.map((social) => {
            const Glyph = SOCIAL_GLYPHS[social.icon];
            return (
              <a
                key={social.href}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                data-menu-social=""
                data-cursor-hide=""
                className={styles.tile}
                onMouseEnter={onTileEnter}
                onMouseLeave={onTileLeave}
              >
                <span className={styles.tileFillWrap} aria-hidden="true">
                  <span className={styles.tileFill} />
                </span>
                <span className={styles.tileIcon}>
                  <Glyph className={styles.tileGlyph} />
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
