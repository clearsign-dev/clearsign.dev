"use client";

import { Motes } from "./Motes";
import { Smoke } from "./Smoke";
import styles from "./VoidScene.module.css";

// The room behind the 404: black, smoky, lit by one source at the centre of
// the viewport (the aperture, drawn by the heading). Everything here is
// procedural and decorative. Layers, back to front: ambient light, smoke,
// rays, lit walls, the wet floor, dust, then a vignette.
//
// `hover` leans the room toward the light; `leaving` rushes into it.

type VoidSceneProps = {
  hover?: boolean;
  leaving?: boolean;
  paused?: boolean;
};

export function VoidScene({ hover = false, leaving = false, paused = false }: VoidSceneProps) {
  return (
    <div
      className={styles.scene}
      data-hover={hover || undefined}
      data-leaving={leaving || undefined}
      aria-hidden="true"
    >
      <div className={styles.room}>
        <div className={styles.ambient} />
        <div className={styles.smoke}>
          <Smoke seed={11} frequency={2} className={styles.smokeFar} />
          <Smoke seed={37} frequency={3.1} className={styles.smokeNear} />
        </div>
        <div className={styles.rays} />
        <div className={styles.wallUpper} />
        <div className={styles.wallLower} />
        <div className={styles.floor}>
          <div className={styles.wet} />
          <div className={styles.pool} />
          <div className={styles.spill} />
        </div>
        <Motes paused={paused} className={styles.motes} />
      </div>
      <div className={styles.vignette} />
    </div>
  );
}
