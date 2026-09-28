# Page topology: the home stage

## Layers, bottom to top

| z | Layer | Component | Notes |
|---|---|---|---|
| — | scroll wrapper | `stage/Stage` | fixed, full viewport, native scroll hidden; holds an invisible track 8000px tall (×1.5 on touch) that Lenis eases |
| 1 | 3D scene | `scene/Scene` | fixed canvas, black ground, reads stage progress |
| 2 | circle background | `chrome/CircleBackground` | concentric arcs and crosshairs, hero → proof; not on phones |
| 12 | sections | `stage/Stage` `<main>` | eight absolute full-screen sections, one active; neighbours mounted and transparent |
| above | chrome | header, tick ruler + audio pill, scrollbar, tracker, cursor | fixed |
| above | menu, navigation transition | `chrome/Menu`, `chrome/SmokeTransition` | |
| top | preloader | `chrome/Preloader` | covers everything until START |

## Interaction model

**Scroll-driven, not click-driven.** One global progress value (0..1 through
the track) decides the active section and how far through it the visitor is.
Every reveal in every section is a pure function of that section's progress,
so scrolling back plays everything backwards. The only real-time animations
are the hero's intro (before scrolling unlocks), hovers, the menu and the
navigation transition.

Sections swap by a 0.6s opacity crossfade on their wrapper. Three sections
(problem, proof, evidence) are "holdovers": their wrapper stays opaque while
their own UI fades itself out over the first part of the next section.

Menu items, the tick indicator, the "Get ClearSign" tab and the keyboard
(arrows, Page Up/Down, Space, Home, End) all jump the stage with an eased
Lenis scroll (0.9s for a neighbour, up to 1.8s across the page), landing where
the target section's UI has fully revealed.

## Section timeline

| # | id | share of the track | reference anatomy |
|---|---|---|---|
| 0 | hero | 0.085 | Hero |
| 1 | problem | 0.115 | About |
| 2 | reads | 0.13 | Services |
| 3 | proof | 0.10 | Collaboration |
| 4 | evidence | 0.25 | Blog (train slider) |
| 5 | ships | 0.12 | Partners |
| 6 | getIt | 0.12 | Process |
| 7 | contact | 0.08 | Contact |

The reference gives its short sections very little scroll because a 3D
transition carries them. ClearSign's sections carry more words, so the shares
are rebalanced for reading time. The per-section choreography inside each
share is the reference's, unchanged (`lib/motion/timing.ts`).
