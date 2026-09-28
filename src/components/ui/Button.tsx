"use client";

import {
  useRef,
  type AnimationEvent,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type Ref,
  type TouchEvent,
} from "react";
import { playSfx } from "@/lib/audio/sfx";
import { placeFillAtCentre, placeFillAtPointer } from "./directionalFill";
import { useCtaResonance } from "./useCtaResonance";
import styles from "./Button.module.css";

// The clipped-corner call to action. A fill circle grows from wherever the
// pointer came in, a short glitch runs on entry, and on a fine pointer the
// button leans toward the pointer with a glow under it (see useCtaResonance).

export type ButtonProps = {
  label: string;
  /** Renders an <a>. External links open in a new tab. */
  href?: string;
  type?: "button" | "submit";
  /** "dark" is the default panel button; "accent" is the ClearSign-blue one. */
  variant?: "dark" | "accent";
  /** The header's upright tab: text runs bottom-to-top. */
  vertical?: boolean;
  /** Vertical tabs slide in when this turns true. */
  revealed?: boolean;
  /** The plus-with-diamond icon after the label. */
  showIcon?: boolean;
  disabled?: boolean;
  className?: string;
  /** Text the custom cursor shows while over the button. */
  cursorLabel?: string;
  onClick?: (event: MouseEvent<HTMLElement>) => void;
  "aria-label"?: string;
  // Optional additions beyond the original stub.
  id?: string;
  style?: CSSProperties;
  onTouchStart?: (event: TouchEvent<HTMLElement>) => void;
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
};

const EXTERNAL = /^https?:/i;

function PlusDiamond() {
  return (
    <svg className={styles.icon} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M12 1v22M1 12h22" stroke="currentColor" strokeWidth="1.75" />
      <path d="M12 8.2 15.8 12 12 15.8 8.2 12Z" fill="currentColor" />
    </svg>
  );
}

function reducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Button({
  label,
  href,
  type = "button",
  variant = "dark",
  vertical = false,
  revealed = false,
  showIcon = false,
  disabled = false,
  className = "",
  cursorLabel,
  onClick,
  id,
  style,
  onTouchStart,
  ...aria
}: ButtonProps) {
  const ref = useRef<HTMLAnchorElement & HTMLButtonElement>(null);
  useCtaResonance(ref);

  // A vertical tab that has not slid in yet is out of reach, not just invisible.
  const hidden = vertical && !revealed;
  const inactive = disabled || hidden;

  // Restart the glitch on every entry: drop the flag, force a style flush, set it again.
  const runGlitch = (el: HTMLElement) => {
    if (reducedMotion()) return;
    el.removeAttribute("data-glitch");
    el.getBoundingClientRect();
    el.setAttribute("data-glitch", "");
  };

  const handleEnter = (event: MouseEvent<HTMLElement>) => {
    if (inactive) return;
    placeFillAtPointer(event.currentTarget, event);
    runGlitch(event.currentTarget);
    playSfx("hover");
  };

  const handleLeave = (event: MouseEvent<HTMLElement>) => {
    if (inactive) return;
    placeFillAtPointer(event.currentTarget, event);
  };

  const handleFocus = (event: FocusEvent<HTMLElement>) => {
    if (event.currentTarget.matches(":focus-visible")) placeFillAtCentre(event.currentTarget);
  };

  const handleGlitchEnd = (event: AnimationEvent<HTMLSpanElement>) => {
    if (event.target === event.currentTarget) ref.current?.removeAttribute("data-glitch");
  };

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (inactive) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };

  const classes = [
    styles.button,
    variant === "accent" ? styles.accent : "",
    vertical ? styles.vertical : "",
    vertical && revealed ? styles.revealed : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const common = {
    id,
    style,
    className: classes,
    "data-cursor-label": cursorLabel,
    onMouseEnter: handleEnter,
    onMouseLeave: handleLeave,
    onFocus: handleFocus,
    onClick: handleClick,
    onTouchStart: inactive ? undefined : onTouchStart,
    ...(hidden ? { "aria-hidden": true, tabIndex: -1 } : {}),
    ...aria,
  };

  const inner = (
    <>
      <span className={styles.bg} aria-hidden="true" />
      <span className={styles.circleWrap} aria-hidden="true">
        <span className={styles.circle} />
      </span>
      <span className={styles.glitch} aria-hidden="true" onAnimationEnd={handleGlitchEnd} />
      <span className={styles.content}>
        <span className={styles.label}>{label}</span>
        {showIcon ? <PlusDiamond /> : null}
      </span>
    </>
  );

  if (href !== undefined) {
    const external = EXTERNAL.test(href);
    return (
      <a
        ref={ref as Ref<HTMLAnchorElement>}
        href={disabled ? undefined : href}
        aria-disabled={disabled || undefined}
        role={disabled ? "link" : undefined}
        tabIndex={disabled ? -1 : undefined}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        {...common}
      >
        {inner}
      </a>
    );
  }

  return (
    <button ref={ref as Ref<HTMLButtonElement>} type={type} disabled={disabled} {...common}>
      {inner}
    </button>
  );
}
