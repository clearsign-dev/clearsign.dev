"use client";

// STUB — the API is fixed; the scene builder replaces this with the Three.js
// particle scene. The home page mounts it once, behind the sections. It reads
// stage progress from the store itself and reports its own loading progress
// to the preloader store.

export type SceneProps = {
  className?: string;
};

export function Scene({ className }: SceneProps) {
  return <div className={className} aria-hidden="true" />;
}
