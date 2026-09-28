"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// After a stretch with no input at all, the page asks once whether anyone is
// still there. Any pointer, key, wheel or touch activity restarts the wait.
// It shows at most once per visit: dismissing it, or it having been seen,
// retires it.

const ACTIVITY_EVENTS = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;

export function useIdleHint(enabled: boolean, delayMs = 5000) {
  const [shown, setShown] = useState(false);
  const retired = useRef(false);

  useEffect(() => {
    if (!enabled || retired.current) return;
    let timer = 0;
    const schedule = () => {
      window.clearTimeout(timer);
      if (retired.current) return;
      timer = window.setTimeout(() => {
        if (retired.current) return;
        retired.current = true;
        setShown(true);
      }, delayMs);
    };
    schedule();
    for (const type of ACTIVITY_EVENTS) window.addEventListener(type, schedule, { passive: true });
    return () => {
      window.clearTimeout(timer);
      for (const type of ACTIVITY_EVENTS) window.removeEventListener(type, schedule);
    };
  }, [enabled, delayMs]);

  const dismiss = useCallback(() => {
    retired.current = true;
    setShown(false);
  }, []);

  return { shown: enabled && shown, dismiss };
}
