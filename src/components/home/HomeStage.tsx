"use client";

import type { ComponentType } from "react";
import { AudioEngine } from "@/components/chrome/AudioEngine";
import { AudioVisualiser } from "@/components/chrome/AudioVisualiser";
import { CircleBackground } from "@/components/chrome/CircleBackground";
import { Cursor } from "@/components/chrome/Cursor";
import { ScrollIndicator } from "@/components/chrome/ScrollIndicator";
import { ScrollTracker } from "@/components/chrome/ScrollTracker";
import { Scrollbar } from "@/components/chrome/Scrollbar";
import { Contact } from "@/components/sections/Contact";
import { GetIt } from "@/components/sections/GetIt";
import { Hero } from "@/components/sections/Hero";
import { Problem } from "@/components/sections/Problem";
import { Ships } from "@/components/sections/Ships";
import { IntroController } from "@/components/stage/IntroController";
import { Stage, type SectionProps } from "@/components/stage/Stage";
import { SECTIONS, SECTION_INDEX } from "@/lib/stage/sections";
import { stageProgress, useStore } from "@/lib/stage/store";
import styles from "./HomeStage.module.css";

// Placeholder bodies until each section's builder lands.
function placeholder(label: string): ComponentType<SectionProps> {
  function Placeholder({ progress }: SectionProps) {
    return (
      <div style={{ margin: "auto", fontSize: 24, color: "var(--text)" }}>
        {label} · {progress.toFixed(2)}
      </div>
    );
  }
  Placeholder.displayName = `Placeholder(${label})`;
  return Placeholder;
}

const BUILT: Partial<Record<string, ComponentType<SectionProps>>> = {
  hero: Hero,
  problem: Problem,
  ships: Ships,
  getIt: GetIt,
  contact: Contact,
};

const SECTION_COMPONENTS: ComponentType<SectionProps>[] = SECTIONS.map(
  (s) => BUILT[s.id] ?? placeholder(s.indicatorLabel),
);

export function HomeStage() {
  const contactActive = useStore(stageProgress, (p) => p.step === SECTION_INDEX.contact);
  return (
    <>
      <IntroController />
      <AudioEngine />
      <Stage sections={SECTION_COMPONENTS}>
        <CircleBackground />
        <ScrollIndicator />
        <Scrollbar />
        {/* Desktop: both place themselves. ≤1024px: this dock lines them up at the bottom. */}
        <div className={styles.dock}>
          <ScrollTracker />
          <AudioVisualiser mobileHidden={contactActive} />
        </div>
      </Stage>
      {/* Outside the stage so it can sit above every layer and invert what it covers. */}
      <Cursor />
    </>
  );
}
