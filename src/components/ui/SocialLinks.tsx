"use client";

import type { FocusEvent, MouseEvent, ReactNode } from "react";
import { playSfx } from "@/lib/audio/sfx";
import { SOCIALS } from "@/lib/content";
import { placeFillAtCentre, placeFillAtPointer } from "./directionalFill";
import styles from "./SocialLinks.module.css";

// Square icon links. Hovering floods the square with a circle that grows from
// where the pointer came in, and the glyph flips colour against it. The custom
// cursor steps aside over them (data-cursor-hide), as it does on the reference.

type Social = (typeof SOCIALS)[number];

type SocialLinksProps = {
  /** "light" for dark grounds (white squares); "dark" for the light menu panel. */
  theme?: "light" | "dark";
  /** The contact panel's smaller, bordered squares. */
  compact?: boolean;
  className?: string;
};

// GitHub mark: the CC0 glyph from simple-icons.
function GitHubGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="currentColor"
        d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"
      />
    </svg>
  );
}

const GLYPHS: Record<Social["icon"], () => ReactNode> = {
  github: GitHubGlyph,
};

export function SocialLinks({ theme = "light", compact = false, className = "" }: SocialLinksProps) {
  const onEnter = (event: MouseEvent<HTMLAnchorElement>) => {
    placeFillAtPointer(event.currentTarget, event);
    playSfx("hover");
  };
  const onLeave = (event: MouseEvent<HTMLAnchorElement>) => {
    placeFillAtPointer(event.currentTarget, event);
  };
  const onFocus = (event: FocusEvent<HTMLAnchorElement>) => {
    if (event.currentTarget.matches(":focus-visible")) placeFillAtCentre(event.currentTarget);
  };

  return (
    <div
      className={[
        styles.socials,
        theme === "dark" ? styles.dark : styles.light,
        compact ? styles.compact : "",
        className,
      ].join(" ")}
    >
      {SOCIALS.map((social) => {
        const Glyph = GLYPHS[social.icon];
        return (
          <a
            key={social.href}
            href={social.href}
            className={styles.item}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.label}
            data-cursor-hide=""
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onFocus={onFocus}
          >
            <span className={styles.bg} aria-hidden="true" />
            <span className={styles.circleWrap} aria-hidden="true">
              <span className={styles.circle} />
            </span>
            <span className={styles.icon}>
              <Glyph />
            </span>
          </a>
        );
      })}
    </div>
  );
}
