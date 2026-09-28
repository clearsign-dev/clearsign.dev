"use client";

import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/audio/sfx";
import styles from "./CopyCommand.module.css";

// A command on one selectable line, with a button that copies it.

const COPIED_MS = 1600;

type CopyCommandProps = {
  command: string;
  className?: string;
};

async function writeClipboard(text: string, fallbackNode: HTMLElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused or unavailable: fall through to selecting the text.
  }
  if (!fallbackNode) return false;
  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(fallbackNode);
  selection?.removeAllRanges();
  selection?.addRange(range);
  try {
    // Deprecated, but the only synchronous path left on insecure origins. If it
    // fails the command stays selected for the visitor to copy by hand.
    const ok = document.execCommand("copy");
    if (ok) selection?.removeAllRanges();
    return ok;
  } catch {
    return false;
  }
}

export function CopyCommand({ command, className = "" }: CopyCommandProps) {
  const codeRef = useRef<HTMLElement>(null);
  const timer = useRef(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    const ok = await writeClipboard(command, codeRef.current);
    if (!ok) return;
    playSfx("click");
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <div className={`${styles.command} ${className}`} data-copied={copied || undefined}>
      <code ref={codeRef} className={`${styles.code} selectable`}>
        {command}
      </code>
      <button
        type="button"
        className={styles.copy}
        aria-label="Copy command"
        onClick={copy}
        onMouseEnter={() => playSfx("hover")}
      >
        <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" focusable="false">
          {copied ? (
            <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <>
              <rect x="5.5" y="5.5" width="8" height="8" rx="1.25" stroke="currentColor" strokeWidth="1.1" />
              <path d="M10.5 3.5v-.25c0-.69-.56-1.25-1.25-1.25h-5.5c-.69 0-1.25.56-1.25 1.25v5.5c0 .69.56 1.25 1.25 1.25h.25" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
            </>
          )}
        </svg>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </div>
  );
}
