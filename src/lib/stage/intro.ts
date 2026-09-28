import { createStore } from "./store";

// The hero's intro runs in phases once the preloader has gone: logo, then the
// peripheral UI, then the menu buttons, the meta text, and finally the
// headline. Components compare against HERO_INTRO_PHASE(_MOBILE).
export const introPhase = createStore(0);
