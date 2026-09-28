"use client";

import { useId, useSyncExternalStore } from "react";
import styles from "./LandscapeOverlay.module.css";

// Asks phone and tablet visitors holding the device sideways to turn it
// upright. Desktop windows of any shape never see it. Not in content.ts: a
// single functional line of our own.
const LINE = "Rotate your device";

function supported(query: MediaQueryList | undefined): query is MediaQueryList {
  // An unparseable query reports "not all".
  return !!query && query.media !== "not all";
}

function isTouchDevice(): boolean {
  const coarse = window.matchMedia?.("(pointer: coarse)");
  if (supported(coarse)) return coarse.matches;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function isLandscape(): boolean {
  const type = typeof screen !== "undefined" ? screen.orientation?.type : undefined;
  if (type) return type.startsWith("landscape");
  const query = window.matchMedia?.("(orientation: landscape)");
  if (supported(query)) return query.matches;
  return window.innerWidth > window.innerHeight;
}

const snapshot = () => isTouchDevice() && isLandscape();
const serverSnapshot = () => false;

function subscribe(onChange: () => void) {
  const orientation = typeof screen !== "undefined" ? screen.orientation : undefined;
  const queries = ["(orientation: landscape)", "(pointer: coarse)"]
    .map((q) => window.matchMedia?.(q))
    .filter((q): q is MediaQueryList => !!q);
  orientation?.addEventListener?.("change", onChange);
  queries.forEach((q) => q.addEventListener?.("change", onChange));
  window.addEventListener("orientationchange", onChange);
  window.addEventListener("resize", onChange);
  return () => {
    orientation?.removeEventListener?.("change", onChange);
    queries.forEach((q) => q.removeEventListener?.("change", onChange));
    window.removeEventListener("orientationchange", onChange);
    window.removeEventListener("resize", onChange);
  };
}

export function LandscapeOverlay() {
  const visible = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const lineId = useId();

  return (
    <div
      className={styles.overlay}
      data-visible={visible || undefined}
      // The preloader leaves this alone when it makes the rest of the page inert.
      data-inert-exempt=""
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={lineId}
    >
      <div className={styles.inner}>
        <svg
          className={styles.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
          <path d="M10.5 5.25h3" />
        </svg>
        <p id={lineId} className={styles.line}>
          {LINE}
        </p>
      </div>
    </div>
  );
}
