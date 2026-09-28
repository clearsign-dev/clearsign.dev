"use client";

import { useRef, type ElementType } from "react";
import { useCtaResonance } from "./useCtaResonance";
import styles from "./Tag.module.css";

// A small grey label chip that leans toward the pointer, gently.

type TagProps = {
  text: string;
  className?: string;
  /** Element to render. Default "div". */
  as?: "div" | "span" | "p" | "li";
};

export function Tag({ text, className = "", as = "div" }: TagProps) {
  const ref = useRef<HTMLElement>(null);
  useCtaResonance(ref, { maxShift: 3.5, maxRotate: 1.4, maxGlow: 0.12 });
  const Element = as as ElementType;
  return (
    <Element ref={ref} className={`${styles.tag} ${className}`}>
      {text}
    </Element>
  );
}
