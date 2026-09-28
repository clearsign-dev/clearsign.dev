// The hover fill on buttons and social squares is a circle that grows from the
// point where the pointer crossed the edge, and shrinks back toward where it
// left. This places it: centred on the pointer, and big enough to reach the
// farthest corner, plus a little so the edge never shows.

const OVERSHOOT_PX = 24;

function place(node: HTMLElement, x: number, y: number, rect: DOMRect) {
  const reach = Math.max(
    Math.hypot(x, y),
    Math.hypot(rect.width - x, y),
    Math.hypot(x, rect.height - y),
    Math.hypot(rect.width - x, rect.height - y),
  );
  node.style.setProperty("--button-circle-x", `${x.toFixed(2)}px`);
  node.style.setProperty("--button-circle-y", `${y.toFixed(2)}px`);
  node.style.setProperty("--button-circle-size", `${(reach * 2 + OVERSHOOT_PX).toFixed(2)}px`);
}

/** Centre the fill circle on the pointer. Call on mouseenter and mouseleave. */
export function placeFillAtPointer(node: HTMLElement, event: { clientX: number; clientY: number }) {
  const rect = node.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  place(node, event.clientX - rect.left, event.clientY - rect.top, rect);
}

/** Centre the fill circle in the element (keyboard focus has no pointer). */
export function placeFillAtCentre(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  place(node, rect.width / 2, rect.height / 2, rect);
}
