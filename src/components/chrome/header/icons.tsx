// Small drawn glyphs for the header and menu. All decorative: the controls
// that hold them carry the accessible names.

type GlyphProps = { className?: string };

/** Four squares at the corners of a box: the "Menu" glyph. */
export function GridGlyph({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="3.2" height="3.2" />
      <rect x="8.8" y="0" width="3.2" height="3.2" />
      <rect x="0" y="8.8" width="3.2" height="3.2" />
      <rect x="8.8" y="8.8" width="3.2" height="3.2" />
    </svg>
  );
}

/** Two crossing strokes. */
export function CrossGlyph({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <path d="M4 4 16 16M16 4 4 16" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

/** An arrow heading down-right; the menu rotates it to point right on hover. */
export function ArrowGlyph({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <path d="M5 5 15 15M15 7v8H7" stroke="currentColor" strokeWidth="1.3" strokeMiterlimit="10" />
    </svg>
  );
}

/** A branch: two commits on a trunk and one forked off it. Stands for the repository. */
export function BranchGlyph({ className }: GlyphProps) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true" focusable="false">
      <circle cx="6" cy="4" r="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6" cy="16" r="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="14" cy="6.5" r="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6 6v8M14 8.5c0 3.5-8 2.5-8 5.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
