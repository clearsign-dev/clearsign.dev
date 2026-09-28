"use client";

import { useId, type CSSProperties } from "react";
import { PROOF, type Severity } from "@/lib/content";
import { clamp01, smoothstep } from "@/lib/motion/progress";
import styles from "./RecordPanel.module.css";

// The Bybit record, as ClearSign reads it: the fields that mattered, the
// finding it prints, and the verdict. A card in the Services cards' language,
// revealed a beat behind the call to action with its rows in a stagger.

const HIDDEN_EPSILON = 0.001;
const HASH = /^0x[0-9a-f]{24,}$/i;
// Characters kept at the end of a shortened hash.
const HASH_TAIL = 6;
// Rows that go first when a phone screen is very short (Safe, Nonce).
const OPTIONAL_ROWS = new Set([0, 1]);

const SEVERITY_CLASS: Record<Severity, string> = {
  INFO: styles.info,
  WARNING: styles.warning,
  CRITICAL: styles.critical,
  BLIND: styles.blind,
};

const phase = (progress: number, start: number, span: number) =>
  smoothstep(clamp01((progress - start) / span));

// A layer that fades in while rising a few pixels.
const rise = (value: number, distance = 10): CSSProperties => ({
  opacity: value,
  transform: `translate3d(0, ${(1 - value) * distance}px, 0)`,
});

function Value({ value }: { value: string }) {
  if (!HASH.test(value)) return <span className="selectable">{value}</span>;
  // Shortened in the middle by CSS: the whole string stays in the DOM, so
  // screen readers read it and copying it gives all of it.
  return (
    <span className={`${styles.hash} selectable`} title={value}>
      <span className={styles.hashHead}>{value.slice(0, -HASH_TAIL)}</span>
      <span className={styles.hashTail}>{value.slice(-HASH_TAIL)}</span>
    </span>
  );
}

function Chip({ severity, className = "" }: { severity: Severity; className?: string }) {
  return (
    <span className={`${styles.chip} ${SEVERITY_CLASS[severity]} ${className}`}>[{severity}]</span>
  );
}

type RecordPanelProps = {
  /** Reveal progress, 0..1. */
  progress: number;
  className?: string;
};

export function RecordPanel({ progress, className = "" }: RecordPanelProps) {
  const titleId = useId();
  const { record } = PROOF;
  const p = clamp01(progress);
  const surface = phase(p, 0, 0.5);
  const inverse = 1 - surface;

  return (
    <article
      className={`${styles.panel} ${className}`}
      aria-labelledby={titleId}
      style={{
        opacity: surface,
        visibility: p > HIDDEN_EPSILON ? "visible" : "hidden",
        transform: `perspective(900px) translate3d(0, ${inverse * 28}px, 0) rotateX(${inverse * 4}deg) scale(${0.975 + surface * 0.025})`,
        willChange: p > HIDDEN_EPSILON && p < 1 - HIDDEN_EPSILON ? "transform, opacity" : "auto",
      }}
    >
      <h3 id={titleId} className={styles.title} style={rise(phase(p, 0.1, 0.4))}>
        {record.title}
      </h3>

      <dl className={styles.rows}>
        {record.rows.map(([label, value], i) => (
          <div
            key={label}
            className={`${styles.row} ${OPTIONAL_ROWS.has(i) ? styles.optionalRow : ""}`}
            style={rise(phase(p, 0.16 + i * 0.07, 0.36))}
          >
            <dt className={styles.label}>{label}</dt>
            <dd className={styles.value}>
              <Value value={value} />
            </dd>
          </div>
        ))}
      </dl>

      <div className={styles.output} style={rise(phase(p, 0.6, 0.34))}>
        {record.output.map(({ severity, code }) => (
          <p key={code} className={`${styles.finding} selectable`}>
            <Chip severity={severity} /> <code className={styles.code}>{code}</code>
          </p>
        ))}
        <p className={`${styles.verdict} selectable`}>{record.verdict}</p>
      </div>

      <p className={styles.footnote} style={rise(phase(p, 0.68, 0.3), 8)}>
        {record.footnote}
      </p>

      <div className={styles.legend} style={rise(phase(p, 0.72, 0.28), 8)}>
        <ul className={styles.chips}>
          {PROOF.severities.map(({ severity, text }) => (
            // Focusable so keyboard users can bring up the same text a pointer
            // gets on hover; screen readers read it in line.
            <li key={severity} className={styles.legendItem} tabIndex={0}>
              <Chip severity={severity} />
              <span className={styles.tip}>{text}</span>
            </li>
          ))}
        </ul>
        <p className={styles.exit}>{PROOF.exitCodes}</p>
      </div>
    </article>
  );
}
