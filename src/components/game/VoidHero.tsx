"use client";

// The hidden rhythm game. The 404 page mounts this and sets `open` when the
// visitor enters the Konami code. Bytes fall toward a signing line; press
// their lane as they cross it. See docs/research/components/void-hero.spec.md.

import { clsx } from "clsx";
import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { ComboPopupLayer, type StoredPopup } from "./ComboPopupLayer";
import { GameHud } from "./GameHud";
import {
  EndedCta,
  ExitPanel,
  IdleHint,
  PadLabels,
  PausePanel,
  ReadyCta,
  ResultsPanel,
  type IdleHintKind,
} from "./GamePanels";
import { KEY_TO_LANE, MAX_LIVES, VoidHeroGame } from "./engine/game";
import { readBest, readSettings, saveMuted, saveTrack, saveVolume } from "./engine/storage";
import type { GamePhase, GameSettings, HudState, PadLabel, RunResult } from "./engine/types";
import styles from "./VoidHero.module.css";

export type VoidHeroProps = {
  open: boolean;
  onClose: () => void;
};

const GAME_TITLE = "Byte Hero";
const IDLE_MS = 5000;
const POPUP_CAP = 8;
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "PageUp", "PageDown", "Home", "End", " "]);
const FOCUSABLE = "button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex='-1'])";

export function VoidHero({ open, onClose }: VoidHeroProps) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(<GameModal onClose={onClose} />, document.body);
}

function initialHud(): HudState {
  return {
    score: 0,
    combo: 0,
    lives: MAX_LIVES,
    maxLives: MAX_LIVES,
    stageName: "",
    stageProgress: 0,
    bestScore: readBest().score,
  };
}

function isVisible(el: HTMLElement) {
  return el.getClientRects().length > 0;
}

function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isVisible);
}

/** Focuses the visible [data-autofocus] control, or the dialog itself. */
function focusDefault(root: HTMLElement | null) {
  if (!root) return;
  const target = Array.from(root.querySelectorAll<HTMLElement>("[data-autofocus]")).find(isVisible);
  (target ?? root).focus({ preventScroll: true });
}

function isTextControl(target: EventTarget | null) {
  return target instanceof Element && !!target.closest("input, select, textarea");
}

function isControl(target: EventTarget | null) {
  return target instanceof Element && !!target.closest("button, input, select, textarea, a[href]");
}

function laneOf(event: KeyboardEvent): number | undefined {
  return KEY_TO_LANE[event.key.length === 1 ? event.key.toLowerCase() : event.key];
}

function GameModal({ onClose }: { onClose: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<VoidHeroGame | null>(null);
  const popupId = useRef(0);
  const onCloseRef = useRef(onClose);

  const [phase, setPhase] = useState<GamePhase>("ready");
  const [paused, setPaused] = useState(false);
  const [hud, setHud] = useState<HudState>(initialHud);
  const [settings, setSettings] = useState<GameSettings>(readSettings);
  const [popups, setPopups] = useState<StoredPopup[]>([]);
  const [padLabels, setPadLabels] = useState<PadLabel[]>([]);
  const [result, setResult] = useState<RunResult | null>(null);
  const [hint, setHint] = useState<IdleHintKind | null>(null);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // The engine lives exactly as long as the dialog: canvas, rAF, listeners
  // and the AudioContext all go with it.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let game: VoidHeroGame;
    try {
      game = new VoidHeroGame(canvas, {
        onHud: setHud,
        onPopup: (popup) => {
          popupId.current += 1;
          const id = popupId.current;
          setPopups((list) => [...list.slice(-(POPUP_CAP - 1)), { ...popup, id }]);
        },
        onPadLabels: setPadLabels,
        onRunEnd: (run) => {
          setResult(run);
          setPhase("ended");
          setPopups([]);
        },
        onPause: setPaused,
        onHint: setHint,
      });
    } catch {
      return;
    }
    gameRef.current = game;
    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  // Focus moves in on open and goes back to where it was on close.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    focusDefault(rootRef.current);
    return () => {
      previous?.focus({ preventScroll: true });
    };
  }, []);

  // During play the dialog itself holds focus, so Space and Enter cannot
  // press a button by accident; panels take focus when they appear.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || phase === "ready") return;
    if (phase === "ended" || paused) focusDefault(root);
    else root.focus({ preventScroll: true });
  }, [phase, paused]);

  const close = useCallback(() => onCloseRef.current(), []);

  const beginRun = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    game.start();
    setPhase("playing");
    setPaused(false);
    setResult(null);
    setHint(null);
    setPopups([]);
  }, []);

  const endRun = useCallback(() => gameRef.current?.endRun(), []);
  const changePause = useCallback((next: boolean) => gameRef.current?.setPaused(next), []);

  const changeTrack = useCallback((id: string) => {
    setSettings((s) => ({ ...s, trackId: id }));
    saveTrack(id);
    gameRef.current?.setTrack(id);
  }, []);

  const changeVolume = useCallback((volume: number) => {
    setSettings((s) => ({ ...s, volume }));
    saveVolume(volume);
    gameRef.current?.setVolume(volume);
  }, []);

  const toggleMute = useCallback(() => {
    const game = gameRef.current;
    if (!game) return;
    const muted = !game.isMuted;
    game.setMuted(muted);
    saveMuted(muted);
    setSettings((s) => ({ ...s, muted }));
  }, []);

  const refocusAfterPointer = useCallback((event: MouseEvent) => {
    // A keyboard press reports detail 0 and keeps its focus.
    if (event.detail > 0) rootRef.current?.focus({ preventScroll: true });
  }, []);

  const removePopup = useCallback((id: number) => {
    setPopups((list) => list.filter((p) => p.id !== id));
  }, []);

  // Keyboard: captured at the window so the page underneath never sees the
  // keys the game uses.
  useEffect(() => {
    const consume = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const root = rootRef.current;
      if (e.key === "Escape") {
        consume(e);
        close();
        return;
      }
      if (e.key === "Tab" && root) {
        const items = focusables(root);
        if (items.length === 0) {
          consume(e);
          root.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement;
        const inside = active instanceof Node && root.contains(active);
        if (!inside || (e.shiftKey && (active === first || active === root)) || (!e.shiftKey && active === last)) {
          consume(e);
          (e.shiftKey ? last : first).focus();
        }
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const lane = laneOf(e);
      if (lane !== undefined && phase === "playing") {
        consume(e);
        if (!e.repeat && !paused) gameRef.current?.laneDown(lane, `key:${e.code || e.key}`, e.timeStamp);
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "m") {
        consume(e);
        if (!e.repeat) toggleMute();
        return;
      }
      if (key === "p" && phase === "playing") {
        consume(e);
        if (!e.repeat) changePause(!paused);
        return;
      }
      if ((e.key === "Enter" || e.key === " ") && !isControl(e.target) && (phase === "ready" || phase === "ended")) {
        consume(e);
        if (!e.repeat) beginRun();
        return;
      }
      if (SCROLL_KEYS.has(e.key) && !isTextControl(e.target)) e.preventDefault();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      const lane = laneOf(e);
      if (lane === undefined) return;
      gameRef.current?.laneUp(lane, `key:${e.code || e.key}`);
      if (phase === "playing") e.stopPropagation();
    };

    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("keyup", onKeyUp, true);
    };
  }, [phase, paused, beginRun, changePause, close, toggleMute]);

  // The page behind must not scroll while the game is open.
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stop = (e: Event) => {
      if (e.type === "touchmove" && isTextControl(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
    };
    root.addEventListener("wheel", stop, { passive: false });
    root.addEventListener("touchmove", stop, { passive: false });
    return () => {
      root.removeEventListener("wheel", stop);
      root.removeEventListener("touchmove", stop);
    };
  }, []);

  // Idle hint on the start screen after five seconds without any input.
  useEffect(() => {
    if (phase !== "ready") return;
    const show = () => setHint((current) => current ?? "start");
    let timer = window.setTimeout(show, IDLE_MS);
    const bump = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(show, IDLE_MS);
    };
    const events = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const name of events) window.addEventListener(name, bump, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const name of events) window.removeEventListener(name, bump);
    };
  }, [phase]);

  const critical = phase === "ended" && result?.reason === "hearts";
  const bigText = critical ? "DO NOT SIGN" : String(phase === "ended" && result ? result.score : hud.score);
  const status =
    phase === "ended" && result
      ? critical
        ? `Run over. Do not sign. Score ${result.score}.`
        : `Run complete. Score ${result.score}.`
      : phase === "playing"
        ? paused
          ? "Paused."
          : "Run started."
        : "";

  return (
    <div
      ref={rootRef}
      className={clsx(styles.root, critical && styles.rootCritical)}
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-label={GAME_TITLE}
      tabIndex={-1}
    >
      <div className={clsx(styles.bigScore, critical && styles.bigScoreCritical)} aria-hidden="true">
        {bigText}
      </div>

      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-hidden="true"
        onPointerDown={(e) => {
          const game = gameRef.current;
          if (!game || phase !== "playing") return;
          e.preventDefault();
          e.currentTarget.setPointerCapture?.(e.pointerId);
          game.pointerDown(e.nativeEvent);
        }}
        onPointerUp={(e) => gameRef.current?.pointerUp(e.nativeEvent)}
        onPointerCancel={(e) => gameRef.current?.pointerUp(e.nativeEvent)}
        onContextMenu={(e) => e.preventDefault()}
      />

      <GameHud
        title={GAME_TITLE}
        phase={phase}
        paused={paused}
        hud={hud}
        settings={settings}
        onTrack={changeTrack}
        onVolume={changeVolume}
        onMute={toggleMute}
        onPause={changePause}
        onPointerAction={refocusAfterPointer}
      />

      <button type="button" className={clsx(styles.panel, styles.close)} onClick={close} aria-label="Exit game">
        <span aria-hidden="true">Exit</span>
        <kbd className={styles.kbd} aria-hidden="true">
          Esc
        </kbd>
      </button>

      {phase === "ready" && <ReadyCta onStart={beginRun} />}

      {phase === "ended" && result && (
        <ResultsPanel
          result={result}
          settings={settings}
          onRetry={beginRun}
          onExit={close}
          onTrack={changeTrack}
          onVolume={changeVolume}
          onMute={toggleMute}
        />
      )}
      {phase === "ended" && <EndedCta onRetry={beginRun} onExit={close} />}

      {phase === "playing" && !paused && <ExitPanel onEnd={endRun} />}
      {phase === "playing" && paused && <PausePanel onResume={() => changePause(false)} onEnd={endRun} />}
      {phase === "playing" && <PadLabels labels={padLabels} />}

      <ComboPopupLayer popups={popups} onDone={removePopup} />
      {hint && <IdleHint kind={hint} onStart={beginRun} />}

      <p className={styles.srOnly} aria-live="polite">
        {status}
      </p>
    </div>
  );
}
