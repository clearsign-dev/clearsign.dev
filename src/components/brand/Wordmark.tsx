import { Mark } from "./Mark";
import styles from "./Wordmark.module.css";

// Mark plus name, set the way brand/clearsign-wordmark.svg sets it: IBM Plex
// Sans 600, tracked in by 8/300 of the size. The name is live text rather than
// SVG text, so it uses the page's own loaded font.

type WordmarkProps = {
  /** Height of the mark's box; the name scales from it. */
  height?: number;
  /** Override the name's size (the SVG's own ratio is 0.293 of the height). */
  nameSize?: string;
  className?: string;
};

export function Wordmark({ height = 32, nameSize, className = "" }: WordmarkProps) {
  const style = { "--wm-h": `${height}px`, ...(nameSize ? { "--wm-name": nameSize } : {}) };
  return (
    <span className={`${styles.wordmark} ${className}`} style={style as React.CSSProperties}>
      <Mark size={height} title="" className={styles.mark} />
      <span className={styles.name}>ClearSign</span>
    </span>
  );
}
