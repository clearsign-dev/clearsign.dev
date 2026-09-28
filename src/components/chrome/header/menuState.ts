import { createStore } from "@/lib/stage/store";

// `menuOpen` says what the visitor asked for; this says where the panel is.
// The header needs "closing" so the phone trigger stays away until the panel
// has fully left, as on the reference.
export type MenuPhase = "closed" | "open" | "closing";

export const menuPhase = createStore<MenuPhase>("closed");

export const MENU_ID = "site-menu";
