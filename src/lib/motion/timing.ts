import { beat } from "./progress";

// Per-section choreography, in section-progress units (0 = the section just
// became active, 1 = the next one takes over). Each section maps onto the
// reference section whose anatomy it borrows, and keeps that section's timing:
//   problem ← About, reads ← Services, proof ← Collaboration,
//   evidence ← Blog, ships ← Partners, getIt ← Process, contact ← Contact.

const HEADING_MOTION = {
  desktop: { duration: 0.72, stagger: 0.012 },
  mobile: { duration: 0.64, stagger: 0.016 },
} as const;

// Supporting UI (plus markers and the like) appears once the heading is this far in.
export const SUPPORTING_UI_REVEAL = 0.28;

export const HERO_INTRO_PHASE = {
  logo: 1,
  uiGroup: 2,
  menuButtons: 3,
  primaryText: 4,
  secondaryText: 5,
  heading: 6,
} as const;

export const HERO_INTRO_PHASE_MOBILE = {
  logo: 1,
  buttons: 2,
  heading: 3,
  primaryText: 4,
  secondaryText: 5,
  scrollIndicator: 6,
} as const;

export const HERO_INTRO_DELAY_MS = {
  desktop: { uiGroup: 140, menuButtons: 240, primaryText: 360, secondaryText: 470, heading: 620 },
  mobile: { buttons: 150, heading: 320, primaryText: 480, secondaryText: 590, scrollIndicator: 820 },
} as const;

export const HERO_TIMING = {
  // The hero holds fully revealed for the first 54% of its scroll, then scrubs out.
  scrollHoldEnd: 0.54,
  scrollBeats: { heading: beat(0.05, 0.95), secondaryText: beat(0.12, 0.88) },
  topLineDurationMs: 1050,
  textDuration: 0.58,
  headingMotion: { duration: 0.76, stagger: 0.014 },
  // Scrolling unlocks this many seconds before the intro heading finishes.
  unlockBeforeHeadingEnd: 0.16,
} as const;

export const PROBLEM_TIMING = {
  desktop: {
    window: { revealStart: 0.04, revealEnd: 0.52, hideStart: 0.76, hideEnd: 1.16 },
    beats: { heading: beat(0, 0.68), primaryCopy: beat(0.18, 0.56), secondaryCopy: beat(0.49, 0.4) },
    headingMotion: { duration: 0.8, stagger: 0.014 },
    copyDuration: 0.96,
  },
  mobile: {
    window: { revealStart: 0.02, revealEnd: 0.66, hideStart: 0.78, hideEnd: 1.26 },
    beats: { heading: beat(0, 0.74), primaryCopy: beat(0.24, 0.72), secondaryCopy: beat(0.42, 0.66) },
    headingMotion: { duration: 0.9, stagger: 0.024 },
    copyDuration: 0.98,
  },
} as const;

export const READS_TIMING = {
  desktop: {
    window: { revealStart: 0, revealEnd: 0.42, hideStart: 0.72, hideEnd: 1 },
    beats: { heading: beat(0, 0.66), cards: [beat(0.26, 0.52), beat(0.42, 0.42)] },
    headingMotion: HEADING_MOTION.desktop,
  },
  mobile: {
    window: { revealStart: 0.02, revealEnd: 0.44, hideStart: 0.76, hideEnd: 1 },
    beats: { heading: beat(0, 0.52), cards: [beat(0.14, 0.5), beat(0.24, 0.42)] },
    headingMotion: HEADING_MOTION.mobile,
  },
} as const;

export const PROOF_TIMING = {
  desktop: {
    window: { revealStart: 0, revealEnd: 0.44, hideStart: 0.76, hideEnd: 1.22 },
    beats: {
      heading: beat(0, 0.64),
      button: beat(0.15, 0.52),
      subtitle: beat(0.6, 0.36),
      scrimIn: beat(0, 0.32),
      scrimOut: beat(1, 0.1),
    },
    headingMotion: HEADING_MOTION.desktop,
    subtitleDuration: 0.82,
  },
  mobile: {
    window: { revealStart: 0.02, revealEnd: 0.48, hideStart: 0.78, hideEnd: 1.18 },
    beats: {
      heading: beat(0, 0.56),
      button: beat(0.32, 0.44),
      subtitle: beat(0.36, 0.34),
      scrimIn: beat(0, 0.32),
      scrimOut: beat(1, 0.08),
    },
    headingMotion: HEADING_MOTION.mobile,
    subtitleDuration: 0.72,
  },
  phone: {
    window: { revealStart: 0.02, revealEnd: 0.48, hideStart: 0.78, hideEnd: 1.18 },
    beats: {
      heading: beat(0, 0.56),
      subtitle: beat(0.23, 0.46),
      button: beat(0.28, 0.36),
      scrimIn: beat(0, 0.32),
      scrimOut: beat(1, 0.08),
    },
    headingMotion: HEADING_MOTION.mobile,
    subtitleDuration: 0.72,
  },
} as const;

export const EVIDENCE_TIMING = {
  desktop: {
    window: { revealStart: 0.12, revealEnd: 0.32, hideStart: 0.86, hideEnd: 1.12 },
    content: beat(0.25, 0.1),
    descriptionHide: beat(0.78, 0.26),
    // The slider travels across its slides between these points.
    slides: beat(0.3, 0.56),
    headingMotion: { duration: 0.68, stagger: 0.012 },
    copyDuration: 1.2,
  },
  mobile: {
    window: { revealStart: 0.1, revealEnd: 0.34, hideStart: 0.86, hideEnd: 1.1 },
    content: beat(0.3, 0.14),
    descriptionHide: beat(0.8, 0.24),
    slides: beat(0.34, 0.52),
    headingMotion: HEADING_MOTION.mobile,
    copyDuration: 0.84,
  },
} as const;

export const SHIPS_TIMING = {
  desktop: {
    window: { revealStart: 0.02, revealEnd: 0.42, hideStart: 0.84, hideEnd: 0.98 },
    beats: {
      heading: beat(0, 0.66),
      divider: beat(0.14, 0.52),
      paragraph: beat(0.15, 0.4),
      cardsReveal: beat(0.18, 0.18),
      cardsMove: beat(0.4, 0.54),
    },
    headingMotion: HEADING_MOTION.desktop,
    copyDuration: 1.02,
    cardItems: {
      surface: beat(0, 0.64),
      number: beat(0.1, 0.56),
      type: beat(0.18, 0.48),
      description: beat(0.28, 0.4),
      icon: beat(0.4, 0.32),
    },
    cardsSmoothingMs: 150,
  },
  mobile: {
    window: { revealStart: 0.02, revealEnd: 0.46, hideStart: 0.84, hideEnd: 0.98 },
    beats: {
      heading: beat(0, 0.66),
      divider: beat(0.14, 0.52),
      paragraph: beat(0.44, 0.4),
      cardsReveal: beat(0.15, 0.13),
      cardsMove: beat(0.4, 0.54),
    },
    headingMotion: HEADING_MOTION.mobile,
    copyDuration: 0.84,
    cardItems: {
      surface: beat(0, 0.68),
      number: beat(0.08, 0.58),
      type: beat(0.14, 0.5),
      description: beat(0.24, 0.42),
      icon: beat(0.34, 0.34),
    },
    cardsSmoothingMs: 135,
  },
} as const;

export const GET_IT_TIMING = {
  desktop: {
    beats: {
      headingReveal: beat(0, 0.21),
      headingHide: beat(0.15, 0.18),
      cardsReveal: beat(0.14, 0.16),
      cardsCycle: beat(0.34, 0.58),
    },
    headingMotion: HEADING_MOTION.desktop,
    cardItems: {
      surface: beat(0, 0.68),
      edge: beat(0.14, 0.56),
      index: beat(0.12, 0.62),
      title: beat(0.18, 0.5),
      description: beat(0.28, 0.44),
    },
    cardsSmoothingMs: 120,
  },
  mobile: {
    beats: {
      headingReveal: beat(0.04, 0.2),
      headingHide: beat(0.4, 0.18),
      cardsReveal: beat(0.18, 0.16),
      cardsCycle: beat(0.4, 0.54),
    },
    headingMotion: HEADING_MOTION.mobile,
    cardItems: {
      surface: beat(0, 0.66),
      edge: beat(0.1, 0.58),
      index: beat(0.1, 0.52),
      title: beat(0.2, 0.44),
      description: beat(0.32, 0.36),
    },
    cardsSmoothingMs: 135,
  },
} as const;

export const CONTACT_TIMING = {
  desktop: {
    panelRevealEnd: 0.3,
    revealWindow: 0.42,
    beats: {
      heading: beat(0.02, 0.36),
      nameField: beat(0.12, 0.34),
      emailField: beat(0.18, 0.32),
      lead: beat(0.28, 0.3),
      message: beat(0.32, 0.28),
      submit: beat(0.46, 0.26),
      credit: beat(0.56, 0.24),
      socials: beat(0.66, 0.22),
      footerPrimary: beat(0.72, 0.2),
      footerSecondary: beat(0.78, 0.18),
    },
    headingMotion: { duration: 0.62, stagger: 0.03 },
    footerDuration: 0.68,
  },
  mobile: {
    panelRevealEnd: 0.26,
    revealWindow: 0.52,
    beats: {
      heading: beat(0.02, 0.22),
      lead: beat(0.12, 0.21),
      credit: beat(0.24, 0.2),
      socials: beat(0.32, 0.19),
      nameField: beat(0.42, 0.18),
      emailField: beat(0.5, 0.17),
      message: beat(0.58, 0.16),
      submit: beat(0.68, 0.15),
      footerPrimary: beat(0.78, 0.14),
      footerSecondary: beat(0.84, 0.13),
    },
    headingMotion: { duration: 0.54, stagger: 0.024 },
    footerDuration: 0.54,
  },
} as const;

// How far into each section its UI is fully shown; the scroll indicator uses it
// to decide where a tick click should land.
export const SECTION_REVEAL_COMPLETE = {
  desktop: [
    0,
    PROBLEM_TIMING.desktop.window.revealEnd,
    READS_TIMING.desktop.window.revealEnd,
    PROOF_TIMING.desktop.window.revealEnd,
    EVIDENCE_TIMING.desktop.window.revealEnd,
    SHIPS_TIMING.desktop.window.revealEnd,
    GET_IT_TIMING.desktop.beats.cardsReveal.end,
    CONTACT_TIMING.desktop.revealWindow,
  ],
  mobile: [
    0,
    PROBLEM_TIMING.mobile.window.revealEnd,
    READS_TIMING.mobile.window.revealEnd,
    PROOF_TIMING.mobile.window.revealEnd,
    EVIDENCE_TIMING.mobile.content.end,
    SHIPS_TIMING.mobile.window.revealEnd,
    GET_IT_TIMING.mobile.beats.cardsReveal.end,
    CONTACT_TIMING.mobile.revealWindow,
  ],
} as const;
