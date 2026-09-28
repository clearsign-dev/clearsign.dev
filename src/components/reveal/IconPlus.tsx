import styles from "./IconPlus.module.css";

// The small "+" registration mark scattered around each section. It spins a
// quarter turn every 3.6s and hides with its section's heading.

type Responsive = string | [desktop: string, phone: string];

type IconPlusProps = {
  top?: Responsive;
  left?: Responsive;
  right?: string;
  bottom?: string;
  /** Hidden at ≥ 1024px. */
  desktopHide?: boolean;
  hidden?: boolean;
  className?: string;
};

const pick = (value: Responsive | undefined, i: 0 | 1) =>
  value === undefined ? undefined : Array.isArray(value) ? value[i] : value;

export function IconPlus({ top, left, right, bottom, desktopHide, hidden, className = "" }: IconPlusProps) {
  const style = {
    "--top-desktop": pick(top, 0) ?? "auto",
    "--top-phone": pick(top, 1) ?? "auto",
    "--left-desktop": pick(left, 0) ?? "auto",
    "--left-phone": pick(left, 1) ?? "auto",
    "--right": right ?? "auto",
    "--bottom": bottom ?? "auto",
  } as React.CSSProperties;
  return (
    <span
      className={[styles.icon, desktopHide ? styles.desktopHide : "", hidden ? styles.hidden : "", className].join(" ")}
      style={style}
      aria-hidden="true"
    >
      <svg viewBox="0 0 11 11" width="11" height="11" fill="none">
        <path d="M5.5 0v11M0 5.5h11" stroke="currentColor" strokeWidth="1" />
      </svg>
    </span>
  );
}
