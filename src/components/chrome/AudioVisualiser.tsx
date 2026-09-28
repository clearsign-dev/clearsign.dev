"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { getAnalyser, saveSoundPreference, setVolume, soundVolume, unlockAudio } from "@/lib/audio/engine";
import { playSfx } from "@/lib/audio/sfx";
import { HEADER } from "@/lib/content";
import { HERO_INTRO_PHASE, HERO_INTRO_PHASE_MOBILE } from "@/lib/motion/timing";
import { introPhase } from "@/lib/stage/intro";
import { soundOn, useStore } from "@/lib/stage/store";
import { useLayoutFlags } from "@/lib/stage/useLayoutFlags";
import styles from "./AudioVisualiser.module.css";

// The "Ambient / Sound off" pill beside the tick ruler, and on ≤1024px the
// round sound button in the bottom dock. A dot-matrix scope drawn from the
// engine's analyser; click toggles the drone, a horizontal drag sets volume.
// See docs/research/components/audio-visualiser.spec.md.

const FRAME_MS = 1000 / 30;
// Keep drawing this long after sound goes off, so the fade-out is visible.
const FADE_TAIL_MS = 1400;
const DRAG_THRESHOLD_PX = 6;
const RESTORE_VOLUME = 0.6;
const KEY_STEP = 0.05;
const MAX_DPR = 2;

const DOT_RADIUS = 1.35;
const DOT_PITCH = DOT_RADIUS * 2 + 2.5;
const TAU = Math.PI * 2;
const WHITE = "255 255 255";

// How the scope maps audio to dots, per layout.
const SCOPE = {
  desktop: { knee: 18, reach: 0.9, gate: 0.012, boost: 1 },
  dock: { knee: 34, reach: 1.4, gate: 0.004, boost: 2.3 },
} as const;
const DOCK_DRIFT = 0.03;

type View = {
  on: boolean;
  hovered: boolean;
  dock: boolean;
  revealed: boolean;
  reduced: boolean;
  paused: boolean;
  offAt: number;
};

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(listener: () => void) {
  const query = window.matchMedia(REDUCED_MOTION);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}

/** "#a8aebc" → "168 174 188", for building rgb(… / alpha) strings. */
function hexToChannels(hex: string): string | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => Number.parseInt(h.slice(i, i + 2), 16)).join(" ");
}

function readPalette(el: Element) {
  const css = getComputedStyle(el);
  return {
    accent: css.getPropertyValue("--accent-rgb").trim() || WHITE,
    grey: hexToChannels(css.getPropertyValue("--grey-300")) ?? WHITE,
  };
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export function AudioVisualiser({ mobileHidden = false }: { mobileHidden?: boolean }) {
  const on = useStore(soundOn);
  const volume = useStore(soundVolume);
  const phase = useStore(introPhase);
  const { isMobile } = useLayoutFlags();
  const reduced = useReducedMotion();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);

  const audible = on && volume > 0;
  const revealed = isMobile
    ? phase >= HERO_INTRO_PHASE_MOBILE.scrollIndicator
    : phase >= HERO_INTRO_PHASE.uiGroup;
  const dockHidden = isMobile && mobileHidden;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>({ on, hovered, dock: isMobile, revealed, reduced, paused: dockHidden, offAt: 0 });
  const repaint = useRef<() => void>(() => {});
  const drag = useRef({ active: false, moved: false, swallowClick: false, startX: 0, rect: null as DOMRect | null });

  // Mirror what the canvas needs, then repaint (or restart the loop).
  useEffect(() => {
    const prev = view.current;
    view.current = {
      on,
      hovered,
      dock: isMobile,
      revealed,
      reduced,
      paused: dockHidden,
      offAt: prev.on && !on ? performance.now() : prev.offAt,
    };
    repaint.current();
  }, [on, hovered, isMobile, revealed, reduced, dockHidden]);

  // Canvas: sizing, palette and the draw loop.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const palette = readPalette(canvas);
    let width = 0;
    let height = 0;
    let dpr = 1;
    let raf = 0;
    let lastFrame = 0;
    let samples: Uint8Array<ArrayBuffer> | null = null;

    const pageVisible = () => document.visibilityState === "visible";
    const fading = (v: View) => !v.on && performance.now() - v.offAt < FADE_TAIL_MS;

    const paint = (time: number) => {
      const v = view.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      if (width <= 0 || height <= 0) return;

      const analyser = v.on || fading(v) ? getAnalyser() : null;
      if (analyser) {
        if (!samples || samples.length !== analyser.fftSize) {
          samples = new Uint8Array(new ArrayBuffer(analyser.fftSize));
        }
        analyser.getByteTimeDomainData(samples);
      }
      const data = analyser ? samples : null;

      const scope = v.dock ? SCOPE.dock : SCOPE.desktop;
      let rgb = palette.accent;
      let alpha = 0.94;
      let glow = 0;
      let blur = 0;
      if (v.dock) {
        rgb = v.on ? palette.accent : palette.grey;
        alpha = v.on ? 0.98 : 0.92;
      } else if (v.hovered) {
        rgb = WHITE;
        glow = 0.26;
        blur = 10;
      } else if (v.on) {
        glow = 0.22;
        blur = 7;
      } else {
        // Off: a faint, still row of dots.
        alpha = 0.32;
      }
      ctx.fillStyle = `rgb(${rgb} / ${alpha})`;
      ctx.shadowColor = `rgb(${rgb} / ${glow})`;
      ctx.shadowBlur = blur;
      ctx.globalAlpha = v.revealed ? 1 : 0.82;

      const span = Math.max(0, width - DOT_RADIUS * 2);
      const columns = Math.max(2, Math.floor(span / DOT_PITCH) + 1);
      const step = span / (columns - 1);
      const mid = height / 2;
      const ceiling = Math.max(0, mid - DOT_RADIUS);
      const drift = v.dock && v.on && !v.reduced;

      ctx.beginPath();
      for (let col = 0; col < columns; col += 1) {
        let amp = 0;
        if (data) {
          const at = Math.min(data.length - 1, Math.floor((col / (columns - 1)) * data.length));
          amp = Math.abs(data[at] - 128) / 128;
        }
        amp *= scope.boost;
        if (drift) amp += (DOCK_DRIFT * (1 + Math.cos(time * 0.009 - col * 0.5))) / 2;
        amp = Math.min(1, amp);
        if (amp < scope.gate) amp = 0;
        const reach = Math.min((1 - Math.exp(-scope.knee * amp)) * mid * scope.reach, ceiling);
        const x = DOT_RADIUS + col * step;
        for (let y = 0; y <= reach; y += DOT_PITCH) {
          ctx.moveTo(x + DOT_RADIUS, mid - y);
          ctx.arc(x, mid - y, DOT_RADIUS, 0, TAU);
          if (y > 0) {
            ctx.moveTo(x + DOT_RADIUS, mid + y);
            ctx.arc(x, mid + y, DOT_RADIUS, 0, TAU);
          }
        }
      }
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
    };

    const frame = (time: number) => {
      raf = 0;
      const v = view.current;
      if (v.paused || !pageVisible()) return;
      if (v.on || fading(v)) {
        raf = requestAnimationFrame(frame);
        if (lastFrame !== 0 && time - lastFrame < FRAME_MS) return;
        lastFrame = time;
      }
      paint(time);
    };

    const kick = () => {
      if (raf) return;
      lastFrame = 0;
      raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      // Layout size, not the transformed box (the dock button scales on reveal and hover).
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (w <= 0 || h <= 0) return;
      dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      width = w;
      height = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      kick();
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    document.addEventListener("visibilitychange", kick);
    repaint.current = kick;

    return () => {
      repaint.current = () => {};
      observer.disconnect();
      document.removeEventListener("visibilitychange", kick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const toggle = () => {
    const level = soundVolume.get();
    if (soundOn.get() && level > 0) {
      soundOn.set(false);
      saveSoundPreference(false);
      return;
    }
    if (level === 0) setVolume(RESTORE_VOLUME, { persist: true });
    soundOn.set(true);
    saveSoundPreference(true);
  };

  const onClick = (event: MouseEvent<HTMLButtonElement>) => {
    // A drag ends in a click; it set the volume already, so it does not also toggle.
    if (drag.current.swallowClick && event.detail !== 0) {
      drag.current.swallowClick = false;
      return;
    }
    toggle();
  };

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    // Inside the gesture, so a drag can switch sound on later from pointermove.
    unlockAudio();
    const d = drag.current;
    d.active = true;
    d.moved = false;
    d.swallowClick = false;
    d.startX = event.clientX;
    d.rect = event.currentTarget.getBoundingClientRect();
    if (!isMobile) event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d.active || isMobile || !d.rect) return;
    if (!d.moved) {
      if (Math.abs(event.clientX - d.startX) <= DRAG_THRESHOLD_PX) return;
      d.moved = true;
      setDragging(true);
    }
    if (d.rect.width <= 0) return;
    const level = clamp01((event.clientX - d.rect.left) / d.rect.width);
    setVolume(level);
    if (level > 0 && !soundOn.get()) soundOn.set(true);
  };

  const endDrag = (event: PointerEvent<HTMLButtonElement>, clickFollows: boolean) => {
    const d = drag.current;
    if (!d.active) return;
    d.active = false;
    d.rect = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!d.moved) return;
    d.swallowClick = clickFollows;
    setDragging(false);
    const level = soundVolume.get();
    setVolume(level, { persist: true });
    saveSoundPreference(soundOn.get() && level > 0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowUp"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowDown"
          ? -1
          : 0;
    if (direction === 0) return;
    // The stage skips keys from inside [data-own-keys] and defaultPrevented ones.
    event.preventDefault();
    unlockAudio();
    const level = clamp01(Math.round((soundVolume.get() + direction * KEY_STEP) * 100) / 100);
    setVolume(level, { persist: true });
    if (level > 0 && !soundOn.get()) soundOn.set(true);
    saveSoundPreference(soundOn.get() && level > 0);
  };

  const onPointerEnter = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse") return;
    setHovered(true);
    playSfx("hover");
  };

  const onPointerLeave = (event: PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType !== "mouse") return;
    setHovered(false);
  };

  const className = [
    styles.root,
    revealed ? styles.revealed : "",
    audible ? "" : styles.off,
    dragging ? styles.dragging : "",
    mobileHidden ? styles.dockHidden : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      id="audio-visualiser"
      className={className}
      style={{ "--audio-level": volume } as CSSProperties}
      aria-pressed={audible}
      data-cursor-hide=""
      data-own-keys=""
      onClick={onClick}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(event) => endDrag(event, true)}
      onPointerCancel={(event) => endDrag(event, false)}
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <span className={styles.chrome}>
        <span className={styles.scope}>
          <span className={styles.glow} aria-hidden="true" />
          <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />
          <span className={styles.pct} aria-hidden="true">
            {Math.round(volume * 100)}%
          </span>
        </span>
        <span className={styles.meter} aria-hidden="true" />
        <span className={styles.meta}>
          <span className={styles.statusRow}>
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.kicker}>{HEADER.soundKicker}</span>
          </span>
          <span className={styles.state}>{audible ? HEADER.soundOn : HEADER.soundOff}</span>
        </span>
      </span>
      <span className={`${styles.hoverLabel} ${hovered ? styles.hoverLabelVisible : ""}`} aria-hidden="true">
        {audible ? HEADER.soundMute : HEADER.soundEnable}
      </span>
    </button>
  );
}
