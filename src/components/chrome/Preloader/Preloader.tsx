"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
} from "react";
import { playSfx } from "@/lib/audio/sfx";
import { PRELOADER } from "@/lib/content";
import { EASE, prefersReducedMotion } from "@/lib/motion/easings";
import { introStarted, preloader, soundOn, useStore } from "@/lib/stage/store";
import { Art } from "./Art";
import { Gate } from "./Gate";
import { inertOthers } from "./inertOthers";
import { LoadingLabel } from "./LoadingLabel";
import { PatternCanvas } from "./PatternCanvas";
import { WaitingMessage } from "./WaitingMessage";
import styles from "./Preloader.module.css";

// The loading screen and the sound gate. It covers the page until the visitor
// presses START: the lit grid fills as the scene loads, a counter and a line
// of status copy keep time, and at 100 the circles draw in around the gate.

const MESSAGES = PRELOADER.messages;
const LAST_MESSAGE = MESSAGES.length - 1;
const HOLD_MS = 120;
const GATE_DELAY_MS = 600;
const GATE_DELAY_REDUCED_MS = 50;
const EXIT_MS = 1150;
const EXIT_REDUCED_MS = 300;
const EXIT_GRACE_MS = 300;

const MOTION_VARS = {
  "--ease-reveal": EASE.customReveal,
  "--ease-exit": EASE.power1InOut,
  "--ease-smooth": EASE.lineReveal,
} as CSSProperties;

type MessagePhase = "revealing" | "holding" | "visible" | "hiding";
type MessageState = { index: number; phase: MessagePhase; showing: number };

// Which message the counter has reached.
function unlockedMessage(value: number): number {
  if (value < 25) return 0;
  if (value < 75) return Math.min(1, LAST_MESSAGE);
  return LAST_MESSAGE;
}

export function Preloader() {
  const visible = useStore(preloader, (s) => s.visible);
  return visible ? <PreloaderOverlay /> : null;
}

function PreloaderOverlay() {
  const leaving = useStore(preloader, (s) => s.leaving);
  // Read once on the client; only effects and timers use it.
  const [reduced] = useState(() => prefersReducedMotion());
  const [value, setValue] = useState(0);
  const [message, setMessage] = useState<MessageState>({ index: 0, phase: "revealing", showing: 0 });
  const [sequenceDone, setSequenceDone] = useState(false);
  const [gateReady, setGateReady] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const subtitleId = useId();

  const complete = value >= 100;
  const unlocked = unlockedMessage(value);
  const mustMoveOn = unlocked > message.index || (complete && message.index === LAST_MESSAGE);
  // A visible line hides as soon as the counter has moved past it. Both
  // conditions only ever become true, so this never flips back.
  const phase: MessagePhase = message.phase === "visible" && mustMoveOn ? "hiding" : message.phase;

  const onShown = () => {
    setMessage((m) => (m.phase === "revealing" ? { ...m, phase: "holding" } : m));
  };

  const onHidden = () => {
    if (message.index < unlocked) {
      setMessage((m) => ({ index: m.index + 1, phase: "revealing", showing: m.showing + 1 }));
    } else if (complete && message.index === LAST_MESSAGE) {
      setSequenceDone(true);
    } else {
      setMessage((m) => ({ ...m, phase: "revealing", showing: m.showing + 1 }));
    }
  };

  // A short beat on each fully revealed line before it may hide.
  useEffect(() => {
    if (message.phase !== "holding") return;
    const timer = window.setTimeout(() => {
      setMessage((m) => (m.phase === "holding" ? { ...m, phase: "visible" } : m));
    }, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [message.phase]);

  // The circles start drawing when the last line has gone; the gate follows.
  useEffect(() => {
    if (!sequenceDone) return;
    const timer = window.setTimeout(() => setGateReady(true), reduced ? GATE_DELAY_REDUCED_MS : GATE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [sequenceDone, reduced]);

  useEffect(() => {
    if (gateReady && !preloader.get().leaving) startRef.current?.focus({ preventScroll: true });
  }, [gateReady]);

  // Keyboard focus starts inside the dialog.
  useEffect(() => {
    shellRef.current?.focus({ preventScroll: true });
  }, []);

  // Nothing behind the overlay can be focused or clicked while it is up.
  useEffect(() => {
    const shell = shellRef.current;
    if (!shell || leaving) return;
    return inertOthers(shell);
  }, [leaving]);

  const start = useCallback(() => {
    if (preloader.get().leaving) return;
    soundOn.set(true);
    playSfx("click");
    preloader.set((p) => ({ ...p, leaving: true }));
  }, []);

  const finish = useCallback(() => {
    if (!preloader.get().visible) return;
    preloader.set((p) => ({ ...p, visible: false }));
    introStarted.set(true);
  }, []);

  // Tab stays on START (or nowhere, before the gate); Enter anywhere starts.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (preloader.get().leaving) return;
      const button = startRef.current;
      if (event.key === "Tab") {
        event.preventDefault();
        if (gateReady) button?.focus({ preventScroll: true });
      } else if (event.key === "Enter" && gateReady && event.target !== button) {
        event.preventDefault();
        start();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [gateReady, start]);

  // The shell's fade-out normally ends the preloader; this is the backstop.
  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(finish, (reduced ? EXIT_REDUCED_MS : EXIT_MS) + EXIT_GRACE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving, reduced, finish]);

  const onAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (leaving && event.target === event.currentTarget) finish();
  };

  return (
    <div
      ref={shellRef}
      className={styles.shell}
      style={MOTION_VARS}
      role="dialog"
      aria-modal="true"
      aria-label={sequenceDone ? undefined : PRELOADER.loadingLabel}
      aria-labelledby={sequenceDone ? titleId : undefined}
      aria-describedby={sequenceDone ? subtitleId : undefined}
      tabIndex={-1}
      data-leaving={leaving || undefined}
      onAnimationEnd={onAnimationEnd}
    >
      <div className={styles.pattern}>
        <PatternCanvas onProgress={setValue} className={styles.canvas} />
      </div>

      {/* Persistent, so each new line is announced. */}
      <p className={styles.srOnly} aria-live="polite">
        {sequenceDone ? "" : MESSAGES[message.index]}
      </p>

      {!sequenceDone && (
        <WaitingMessage
          key={message.showing}
          text={MESSAGES[message.index]}
          hiding={phase === "hiding"}
          reduced={reduced}
          onShown={onShown}
          onHidden={onHidden}
        />
      )}

      {sequenceDone && <Art leaving={leaving} />}
      {sequenceDone && (
        <Gate
          ready={gateReady}
          leaving={leaving}
          onStart={start}
          startRef={startRef}
          titleId={titleId}
          subtitleId={subtitleId}
        />
      )}

      <LoadingLabel value={value} />
    </div>
  );
}
