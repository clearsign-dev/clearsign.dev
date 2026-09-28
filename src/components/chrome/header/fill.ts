// Directional fill: the hover circle of a button starts where the pointer
// came in and, on leave, collapses toward where it went out. The circle is
// sized to reach the farthest corner from that point, plus a little margin.
const EDGE_MARGIN = 24;

export function aimFill(element: Element | null, clientX: number, clientY: number) {
  if (!(element instanceof HTMLElement)) return;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  const farthest = Math.max(
    Math.hypot(x, y),
    Math.hypot(rect.width - x, y),
    Math.hypot(x, rect.height - y),
    Math.hypot(rect.width - x, rect.height - y),
  );
  element.style.setProperty("--fill-x", `${x.toFixed(2)}px`);
  element.style.setProperty("--fill-y", `${y.toFixed(2)}px`);
  element.style.setProperty("--fill-size", `${(farthest * 2 + EDGE_MARGIN).toFixed(2)}px`);
}
