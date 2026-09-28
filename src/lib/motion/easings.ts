// The reference's motion vocabulary. Values are design parameters read from
// the live site; names describe the curve.
export const EASE = {
  power2Out: "cubic-bezier(0.33, 1, 0.68, 1)",
  power3Out: "cubic-bezier(0.215, 0.61, 0.355, 1)",
  outQuart: "cubic-bezier(0.22, 1, 0.36, 1)",
  expoOut: "cubic-bezier(0.19, 1, 0.22, 1)",
  power2In: "cubic-bezier(0.64, 0, 0.78, 0)",
  power1InOut: "cubic-bezier(0.45, 0.05, 0.55, 0.95)",
  sineInOut: "cubic-bezier(0.37, 0, 0.63, 1)",
  standard: "cubic-bezier(0.4, 0, 0.2, 1)",
  lineReveal: "cubic-bezier(0.16, 1, 0.3, 1)",
  backOut:
    "linear(0, 0.233 5%, 0.603 15%, 0.859 25%, 1.021 35%, 1.106 45%, 1.132 55%, 1.116 65%, 1.078 75%, 1.035 85%, 1.005 95%, 1 100%)",
  backIn:
    "linear(0, -0.005 5%, -0.035 15%, -0.078 25%, -0.116 35%, -0.132 45%, -0.106 55%, -0.021 65%, 0.141 75%, 0.397 85%, 0.767 95%, 1 100%)",
  customReveal:
    "linear(0, 0.068 0.4%, 0.181 1.3%, 0.299 2.5%, 0.409 4%, 0.505 5.7%, 0.588 7.6%, 0.658 9.7%, 0.717 12.1%, 0.765 14.6%, 0.806 17.2%, 0.841 20.1%, 0.872 23.1%, 0.9 26.2%, 0.926 29.5%, 0.946 33%, 0.96 36.6%, 0.97 40.3%, 0.978 44.2%, 0.983 48.2%, 0.988 52.3%, 0.991 56.5%, 0.993 60.9%, 0.995 65.4%, 0.997 70%, 0.998 74.7%, 0.999 79.5%, 1 89.5%, 1)",
} as const;

// GSAP-style "out" power curves, for keyframes that must be baked because a
// cubic-bezier cannot represent them exactly.
export const powerOut = {
  1: (t: number) => 1 - (1 - t) ** 2,
  2: (t: number) => 1 - (1 - t) ** 3,
  3: (t: number) => 1 - (1 - t) ** 4,
  4: (t: number) => 1 - (1 - t) ** 5,
} as const;

export function isMobileMotionContext(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.innerWidth <= 1024 || window.matchMedia("(hover: none), (pointer: coarse)").matches
  );
}

// Touch and narrow layouts get slightly longer motion, as on the reference.
export function scaleDuration(seconds: number, factor = 1.18): number {
  return isMobileMotionContext() ? seconds * factor : seconds;
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
