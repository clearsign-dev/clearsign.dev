"use client";

import type { MouseEvent } from "react";
import { playSfx } from "@/lib/audio/sfx";

// STUB — the API is fixed; the UI-kit builder replaces the internals with the
// reference's full treatment (clipped corner, directional fill circle, glitch
// on enter, pointer tilt). Other components import this and must not depend on
// anything beyond these props.

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
};

export function Button({
  label,
  href,
  type = "button",
  variant = "dark",
  disabled,
  className = "",
  cursorLabel,
  onClick,
  ...aria
}: ButtonProps) {
  const common = {
    className: `button button--${variant} ${className}`,
    "data-cursor-label": cursorLabel,
    onMouseEnter: () => playSfx("hover"),
    onClick,
    ...aria,
  };
  if (href) {
    const external = /^https?:/.test(href);
    return (
      <a href={disabled ? undefined : href} {...common} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
        <span>{label}</span>
      </a>
    );
  }
  return (
    <button type={type} disabled={disabled} {...common}>
      <span>{label}</span>
    </button>
  );
}
