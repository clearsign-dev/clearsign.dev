// The ClearSign mark: a C as an aperture with an S inside it as a signature
// stroke. Paths are the ones brand/make-mark.py generates, so this matches
// brand/clearsign-mark.svg exactly. Colours come from the page:
//   --mark-c    the aperture (defaults to the accent)
//   --mark-s    the signature (defaults to the ink)
//   --mark-gap  whatever the mark sits on; without it the S merges into the C

export const MARK_PATHS = {
  aperture: "M 683.6 275.8 A 292 292 0 1 0 683.6 748.2",
  signature: "M 635.8 328.0 A 118 118 0 1 0 538.0 512.0 A 118 118 0 1 1 440.2 696.0",
} as const;

type MarkProps = {
  size?: number | string;
  className?: string;
  title?: string;
};

export function Mark({ size = 32, className, title = "ClearSign" }: MarkProps) {
  return (
    <svg
      viewBox="0 0 1024 1024"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={title}
    >
      <path
        d={MARK_PATHS.aperture}
        fill="none"
        stroke="var(--mark-c, var(--accent))"
        strokeWidth={132}
        strokeLinecap="butt"
      />
      <path
        d={MARK_PATHS.signature}
        fill="none"
        stroke="var(--mark-gap, var(--ground))"
        strokeWidth={134}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={MARK_PATHS.signature}
        fill="none"
        stroke="var(--mark-s, var(--ink))"
        strokeWidth={104}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
