"use client";

import type { ComponentType } from "react";
import { IntroController } from "@/components/stage/IntroController";
import { Stage, type SectionProps } from "@/components/stage/Stage";
import { SECTIONS } from "@/lib/stage/sections";

// Placeholder bodies until each section's builder lands. Each is replaced by
// its real component under src/components/sections/.
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

const SECTION_COMPONENTS: ComponentType<SectionProps>[] = SECTIONS.map((s) =>
  placeholder(s.indicatorLabel),
);

export function HomeStage() {
  return (
    <>
      <IntroController />
      <Stage sections={SECTION_COMPONENTS} />
    </>
  );
}
