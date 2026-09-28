"use client";

import type { CSSProperties } from "react";
import { Button } from "@/components/ui/Button";
import type { GET_IT } from "@/lib/content";
import { beatProgress, type Beat } from "@/lib/motion/progress";
import { CopyCommand } from "./CopyCommand";
import styles from "./StepCard.module.css";

// One step of getting ClearSign: title and index across the top, a rule that
// draws in along the top edge, then the text and whatever the step needs (a
// link to the releases, or a command to copy). Layers arrive one after another
// from a single reveal value.

export type StepData = (typeof GET_IT.steps)[number];

export type StepItemTiming = Readonly<{
  surface: Beat;
  edge: Beat;
  index: Beat;
  title: Beat;
  description: Beat;
}>;

type StepCardProps = {
  step: StepData;
  index: number;
  total: number;
  timing: StepItemTiming;
  /** 0..1, the section's cards reveal. */
  revealProgress: number;
};

const SETTLED = 0.999;
const BODY_OPACITY = 0.8;

function layer(p: number, transform: string): CSSProperties {
  return { opacity: p, transform: p >= SETTLED ? "none" : transform };
}

// When the body opens with the step's own command, show the command once, as
// the code line, and keep the rest of the sentence as the paragraph.
function bodyWithoutCommand(step: StepData): string {
  if (!("command" in step) || !step.command) return step.body;
  const { body, command } = step;
  return body.startsWith(command) ? body.slice(command.length).replace(/^[\s.,;:]+/, "") : body;
}

export function StepCard({ step, index, total, timing, revealProgress }: StepCardProps) {
  const surface = beatProgress(revealProgress, timing.surface);
  const edge = beatProgress(revealProgress, timing.edge);
  const indexP = beatProgress(revealProgress, timing.index);
  const title = beatProgress(revealProgress, timing.title);
  const description = beatProgress(revealProgress, timing.description);
  const settled = surface >= SETTLED;

  const surfaceStyle: CSSProperties & Record<"--edge-progress", number> = {
    "--edge-progress": edge,
    opacity: surface,
    transform: settled
      ? "none"
      : `perspective(900px) translate3d(0, ${((1 - surface) * 38).toFixed(2)}px, 0) rotateX(${((1 - surface) * 6).toFixed(2)}deg) scale(${(0.975 + surface * 0.025).toFixed(4)})`,
    willChange: !settled && surface > 0.001 ? "transform, opacity" : "auto",
  };

  const body = bodyWithoutCommand(step);
  const action = "action" in step ? step.action : undefined;
  const command = "command" in step ? step.command : undefined;

  return (
    <div className={styles.card} data-index={index} data-total={total} style={surfaceStyle}>
      <div className={styles.header}>
        <h3 className={styles.title} style={layer(title, `translate3d(0, ${((1 - title) * 14).toFixed(2)}px, 0)`)}>
          {step.title}
        </h3>
        <div
          className={styles.index}
          aria-hidden="true"
          style={layer(indexP, `translate3d(${((1 - indexP) * 12).toFixed(2)}px, 0, 0)`)}
        >
          {String(index + 1).padStart(2, "0")}
        </div>
      </div>
      <div
        className={styles.desc}
        style={{
          ...layer(description, `translate3d(0, ${((1 - description) * 18).toFixed(2)}px, 0)`),
          "--body-opacity": BODY_OPACITY,
        } as CSSProperties}
      >
        {body ? <p className={styles.body}>{body}</p> : null}
        {command ? <CopyCommand command={command} /> : null}
        {action ? (
          <Button label={action.label} href={action.href} variant="dark" showIcon className={styles.action} />
        ) : null}
      </div>
    </div>
  );
}
