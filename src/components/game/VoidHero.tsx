"use client";

// STUB — the API is fixed; the game builder replaces this with the full game.
// The 404 page mounts it and opens it when the Konami code is entered.

export type VoidHeroProps = {
  open: boolean;
  onClose: () => void;
};

export function VoidHero({ open, onClose }: VoidHeroProps) {
  if (!open) return null;
  return (
    <div role="dialog" aria-label="Void Hero" onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
  );
}
