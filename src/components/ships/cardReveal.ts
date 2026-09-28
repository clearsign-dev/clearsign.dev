import { powerOut } from "@/lib/motion/easings";
import { clamp01, type Beat } from "@/lib/motion/progress";

// Each card reveals from its own position in the viewport, not from section
// progress: as the column travels, a card fades, slides and un-blurs in item by
// item (surface first, then the number, the tag, the text and the icon).

export type CardItemTiming = Readonly<{
  surface: Beat;
  number: Beat;
  type: Beat;
  description: Beat;
  icon: Beat;
}>;

type RevealItem = keyof CardItemTiming;

export type CardRevealTarget = {
  /** The untransformed slot the reveal is measured from. */
  slot: HTMLElement;
  items: { el: HTMLElement; item: RevealItem; applied: number }[];
  index: number;
  last: boolean;
};

// A card starts revealing when its leading edge crosses 92% of the viewport
// and has finished by 16%.
const START_AT = 0.92;
const END_AT = 0.16;

const ITEMS: readonly RevealItem[] = ["surface", "number", "type", "description", "icon"];

// Offsets in percent of each item's own size. Desktop items slide in from the
// left; mobile items rise or drop in, alternating by card.
const DESKTOP_X: Record<RevealItem, number> = {
  surface: -20,
  number: -12,
  type: -10,
  description: -14,
  icon: -18,
};
const MOBILE_Y: Record<RevealItem, number> = {
  surface: 24,
  number: 18,
  type: 14,
  description: 16,
  icon: 22,
};
const START_SCALE = 0.94;
const SCALED: ReadonlySet<RevealItem> = new Set(["surface", "icon"]);
const BLUR: Partial<Record<RevealItem, number>> = { surface: 12, description: 4 };

export function collectCardTargets(column: HTMLElement): CardRevealTarget[] {
  const slots = Array.from(column.querySelectorAll<HTMLElement>("[data-ship-card]"));
  return slots.map((slot, index) => ({
    slot,
    index,
    last: index === slots.length - 1,
    items: Array.from(slot.querySelectorAll<HTMLElement>("[data-reveal]"))
      .filter((el) => ITEMS.includes(el.dataset.reveal as RevealItem))
      .map((el) => ({ el, item: el.dataset.reveal as RevealItem, applied: -1 })),
  }));
}

/** 0..1 from where the slot sits in the viewport. Rows (mobile) read the x axis. */
export function viewportProgress(rect: DOMRect, mobile: boolean, last: boolean): number {
  const size = Math.max(1, mobile ? window.innerWidth : window.innerHeight);
  const extent = mobile ? rect.width : rect.height;
  const start = size * START_AT;
  // The last card has to finish while it is fully on screen.
  const end = last ? Math.max(size * END_AT, size - extent) : size * END_AT;
  const edge = mobile ? rect.left : rect.top;
  return clamp01((start - edge) / Math.max(start - end, 1));
}

function timelineEnd(timing: CardItemTiming): number {
  return Math.max(...ITEMS.map((k) => clamp01(timing[k].end)), Number.EPSILON);
}

export function applyCardReveal(
  target: CardRevealTarget,
  progress: number,
  timing: CardItemTiming,
  mobile: boolean,
  blur: boolean,
) {
  const t = clamp01(progress) * timelineEnd(timing);
  const sign = target.index % 2 === 0 ? -1 : 1;
  for (const entry of target.items) {
    const beat = timing[entry.item];
    const start = clamp01(beat.start);
    const end = Math.max(start, clamp01(beat.end));
    const local = end > start ? clamp01((t - start) / (end - start)) : t >= start ? 1 : 0;
    const endpoint = local === 0 || local === 1;
    if (local === entry.applied || (!endpoint && Math.abs(local - entry.applied) < 0.0005)) continue;
    entry.applied = local;

    const { style } = entry.el;
    if (local >= 1) {
      style.opacity = "";
      style.transform = "";
      style.filter = "";
      style.visibility = "";
      style.willChange = "";
      continue;
    }

    // GSAP's power2.out, as a cubic.
    const e = powerOut[2](local);
    const rest = 1 - e;
    const x = mobile ? 0 : DESKTOP_X[entry.item] * rest;
    const y = mobile ? sign * MOBILE_Y[entry.item] * rest : 0;
    const scale = SCALED.has(entry.item) ? ` scale(${(START_SCALE + (1 - START_SCALE) * e).toFixed(4)})` : "";
    const blurPx = blur ? (BLUR[entry.item] ?? 0) * rest : 0;

    style.visibility = local > 0 ? "visible" : "hidden";
    style.opacity = e.toFixed(4);
    style.transform = `translate3d(${x.toFixed(3)}%, ${y.toFixed(3)}%, 0)${scale}`;
    style.filter = blurPx > 0.01 ? `blur(${blurPx.toFixed(2)}px)` : "";
    style.willChange = local > 0 ? "transform, opacity" : "";
  }
}

export function clearCardReveal(target: CardRevealTarget) {
  for (const entry of target.items) {
    const { style } = entry.el;
    style.opacity = "";
    style.transform = "";
    style.filter = "";
    style.visibility = "";
    style.willChange = "";
    entry.applied = -1;
  }
}
