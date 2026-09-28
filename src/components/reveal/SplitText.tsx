import { Fragment, type ReactNode } from "react";

// Text split into words and characters at render time, so reveal animations can
// address each glyph without rewriting DOM that React owns. Words stay intact
// as inline-blocks: lines only ever break at spaces.

export type Segment = string | { text: string; className?: string };

type SplitTextProps = {
  segments: Segment | Segment[];
  /** Wrap each character in an overflow mask so it can rise from below. */
  mask?: boolean;
  charClassName?: string;
};

// The mask crops at the line box, which is shorter than descenders under tight
// heading line-heights; the char pads down and the mask pulls the same back.
const DESCENDER_PAD = "0.2em";

function splitWords(text: string): string[] {
  return text.split(/(\s+)/).filter(Boolean);
}

function Char({ ch, mask, className }: { ch: string; mask: boolean; className: string }) {
  if (!mask) {
    return (
      <span className={`char ${className}`} style={{ display: "inline-block" }}>
        {ch}
      </span>
    );
  }
  return (
    <span
      style={{
        display: "inline-block",
        overflow: "hidden",
        verticalAlign: "bottom",
        marginBottom: `-${DESCENDER_PAD}`,
      }}
    >
      <span
        className={`char ${className}`}
        style={{ display: "inline-block", paddingBottom: DESCENDER_PAD }}
      >
        {ch}
      </span>
    </span>
  );
}

function renderText(text: string, mask: boolean, charClassName: string, keyBase: string): ReactNode[] {
  return splitWords(text).map((word, w) =>
    /^\s+$/.test(word) ? (
      <Fragment key={`${keyBase}-s${w}`}>{word}</Fragment>
    ) : (
      <span key={`${keyBase}-w${w}`} className="word" style={{ display: "inline-block" }}>
        {Array.from(word).map((ch, c) => (
          <Char key={c} ch={ch} mask={mask} className={charClassName} />
        ))}
      </span>
    ),
  );
}

export function SplitText({ segments, mask = false, charClassName = "" }: SplitTextProps) {
  const list = Array.isArray(segments) ? segments : [segments];
  return (
    <>
      {list.map((segment, i) =>
        typeof segment === "string" ? (
          <Fragment key={i}>{renderText(segment, mask, charClassName, `t${i}`)}</Fragment>
        ) : (
          <span key={i} className={segment.className}>
            {renderText(segment.text, mask, charClassName, `t${i}`)}
          </span>
        ),
      )}
    </>
  );
}

export function segmentsText(segments: Segment | Segment[]): string {
  const list = Array.isArray(segments) ? segments : [segments];
  return list.map((s) => (typeof s === "string" ? s : s.text)).join("");
}
