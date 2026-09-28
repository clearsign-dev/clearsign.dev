import { PRELOADER } from "@/lib/content";
import styles from "./Preloader.module.css";

// The "N ◆ Loading" pill in the bottom-left corner.

export function LoadingLabel({ value }: { value: number }) {
  return (
    <div
      className={styles.status}
      role="progressbar"
      aria-label={PRELOADER.loadingLabel}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
    >
      <span>{value}</span>
      <span className={styles.diamond} aria-hidden="true" />
      <span>{PRELOADER.loadingLabel}</span>
    </div>
  );
}
