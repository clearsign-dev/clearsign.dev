// The home page is a stage, not a document: one tall invisible scroll track
// drives a single progress value, and that value picks which full-screen
// section is showing and how far through it we are.

export type SectionId =
  | "hero"
  | "problem"
  | "reads"
  | "proof"
  | "evidence"
  | "ships"
  | "getIt"
  | "contact";

export type SectionTemplate = {
  id: SectionId;
  /** Shown by the bottom-left tracker while the section is active. */
  label: string;
  /** Shown on the header's tick indicator and in the menu. */
  indicatorLabel: string;
  /** Relative share of the scroll track. Normalised so the total is 1. */
  duration: number;
};

export type SectionTimeline = SectionTemplate & {
  index: number;
  start: number;
  end: number;
};

// Shares are tuned for reading time. The reference gives its short About
// section very little scroll because a 3D transition carries it; ClearSign's
// sections carry more words, so the text-heavy ones get more room.
const TEMPLATES: SectionTemplate[] = [
  { id: "hero", label: "Scroll down", indicatorLabel: "Start", duration: 0.085 },
  { id: "problem", label: "The problem", indicatorLabel: "The problem", duration: 0.115 },
  { id: "reads", label: "What it reads", indicatorLabel: "What it reads", duration: 0.13 },
  { id: "proof", label: "Proof", indicatorLabel: "Proof", duration: 0.1 },
  { id: "evidence", label: "Evidence", indicatorLabel: "Evidence", duration: 0.25 },
  { id: "ships", label: "How it ships", indicatorLabel: "How it ships", duration: 0.12 },
  { id: "getIt", label: "Get it", indicatorLabel: "Get it", duration: 0.12 },
  { id: "contact", label: "", indicatorLabel: "Contact", duration: 0.08 },
];

function buildTimelines(templates: SectionTemplate[]): SectionTimeline[] {
  const total = templates.reduce((sum, t) => sum + t.duration, 0);
  let cursor = 0;
  return templates.map((t, index) => {
    const start = cursor;
    cursor += t.duration / total;
    // Pin the last end to exactly 1: the scroll track cannot go past it.
    const end = index === templates.length - 1 ? 1 : cursor;
    return { ...t, index, start, end };
  });
}

export const SECTIONS: readonly SectionTimeline[] = buildTimelines(TEMPLATES);

export const SECTION_INDEX = Object.fromEntries(SECTIONS.map((s) => [s.id, s.index])) as Record<
  SectionId,
  number
>;

export const SECTION_COUNT = SECTIONS.length;

/** Pixels of scroll track on desktop. Touch layouts get 1.5x, as on the reference. */
export const BASE_VIRTUAL_SCROLL_HEIGHT = 8000;
export const MOBILE_SCROLL_HEIGHT_SCALE = 1.5;

export type StageProgress = {
  /** Index of the active section. */
  step: number;
  /** 0..1 through the active section. */
  value: number;
  /** 0..1 through the whole stage. */
  global: number;
};

export function progressAt(global: number): StageProgress {
  const g = Math.max(0, Math.min(1, global));
  for (const s of SECTIONS) {
    if (g < s.end || s.index === SECTION_COUNT - 1) {
      const span = Math.max(s.end - s.start, Number.EPSILON);
      return { step: s.index, value: Math.max(0, Math.min(1, (g - s.start) / span)), global: g };
    }
  }
  return { step: SECTION_COUNT - 1, value: 1, global: g };
}

/** Global progress at a point inside a section. */
export function globalAt(index: number, sectionProgress = 0): number {
  const s = SECTIONS[Math.max(0, Math.min(SECTION_COUNT - 1, index))];
  return s.start + (s.end - s.start) * Math.max(0, Math.min(1, sectionProgress));
}

// Sections within this distance of the active one stay mounted, so a section
// is already built by the time it fades in.
export const SECTION_MOUNT_WINDOW = 1;

export function isSectionMounted(index: number, step: number): boolean {
  return Math.abs(index - step) <= SECTION_MOUNT_WINDOW;
}

// Progress handed to each mounted section. The section just left gets
// 1 + (progress of the new one), so a section that opts in can keep fading its
// UI out across the start of the next.
export function sectionProgressFor(index: number, p: StageProgress): number {
  if (index === p.step) return p.value;
  if (index === p.step - 1) return 1 + p.value;
  return index < p.step ? 1 : 0;
}

// Sections whose UI fades itself out across the next section's opening, so
// their wrapper stays opaque instead of taking the blanket 0.6s section fade.
export const OUTGOING_HOLDOVER: ReadonlySet<SectionId> = new Set(["problem", "proof", "evidence"]);
