import styles from "./TickRuler.module.css";

// The site's tick ruler, as it sits at the top of the void: still, with the
// first tick lit and the marker parked on it. Decorative only; there is
// nothing to scroll here.

const SECTIONS = 8;
const SMALL_PER_GAP = 3;

const TICKS = Array.from({ length: SECTIONS }, (_, section) => [
  { big: true, first: section === 0 },
  ...(section < SECTIONS - 1
    ? Array.from({ length: SMALL_PER_GAP }, () => ({ big: false, first: false }))
    : []),
]).flat();

export function TickRuler({ className = "" }: { className?: string }) {
  return (
    <div className={`${styles.ruler} ${className}`} aria-hidden="true">
      <div className={styles.ticks}>
        {TICKS.map((tick, i) => (
          <span
            key={i}
            className={[styles.tick, tick.big ? styles.big : styles.small, tick.first ? styles.active : ""].join(" ")}
          />
        ))}
      </div>
      <span className={styles.marker}>
        <svg viewBox="0 0 8 5" className={styles.markerTop}>
          <path d="M0 0h8L4 5z" fill="currentColor" />
        </svg>
        <svg viewBox="0 0 8 5" className={styles.markerBottom}>
          <path d="M0 5h8L4 0z" fill="currentColor" />
        </svg>
      </span>
    </div>
  );
}
