import type { SVGProps } from "react";

// Line drawings for the four ways ClearSign ships. One stroke weight, no fill,
// drawn on a 64-unit grid; the stroke stays 1.5px however large the card is.
// Stroke colour comes from `color` (the card sets it to --ink).

export type ShipIconName = "desktop" | "terminal" | "chip" | "layers";

const PATHS: Record<ShipIconName, string[]> = {
  // A monitor: screen, one interface rule, the neck and the foot.
  desktop: ["M8 12h48v32H8z", "M8 19h48", "M32 44v8", "M22 53h20"],
  // A terminal window: title rule, prompt chevron, cursor bar.
  terminal: ["M8 13h48v38H8z", "M8 20h48", "M16 29l7 5-7 5", "M27 40h11"],
  // A package with its die and three pins on each side.
  chip: [
    "M19 19h26v26H19z",
    "M26 26h12v12H26z",
    "M25 11v8M32 11v8M39 11v8",
    "M25 45v8M32 45v8M39 45v8",
    "M11 25h8M11 32h8M11 39h8",
    "M45 25h8M45 32h8M45 39h8",
  ],
  // Three isometric plates: the compartments.
  layers: ["M32 11l22 11-22 11-22-11z", "M10 32l22 11 22-11", "M10 42l22 11 22-11"],
};

type ShipIconProps = SVGProps<SVGSVGElement> & { name: string };

export function ShipIcon({ name, ...rest }: ShipIconProps) {
  const paths = PATHS[name as ShipIconName] ?? PATHS.desktop;
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {paths.map((d) => (
        <path key={d} d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
