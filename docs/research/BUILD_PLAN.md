# Build plan

UI-only. Rebrand of the 2026 daoism.systems. PRD: `PRD.md`.

## Pages

| Route | Page | Status |
|---|---|---|
| `/` | The stage, eight sections | built, checked at 1440×900, 1024×768, 768×1024 and 390×844 |
| `/privacy` | Privacy | built |
| 404 (`not-found.tsx`) | Void page with the Konami-code game | built, game played through headless |

The reference's `/_octagon` showreel route is not built: it has no content of its own.

## The stage

| # | Section | Reference anatomy | Component |
|---|---|---|---|
| 0 | Opening | Hero | `sections/Hero.tsx` |
| 1 | The problem | About | `sections/Problem.tsx` |
| 2 | What it reads | Services (hotspots / cards) | `sections/Reads.tsx` |
| 3 | Proof | Collaboration | `sections/Proof.tsx` |
| 4 | Evidence | Blog (slider) | `sections/Evidence.tsx` |
| 5 | How it ships | Partners (card column) | `sections/Ships.tsx` |
| 6 | Get it | Process (step cards) | `sections/GetIt.tsx` |
| 7 | Contact | Contact | `sections/Contact.tsx` |

## Foundation (done by the foreman)

Tokens, fonts, the stage runtime (`components/stage/Stage.tsx`), the stores,
section timeline, motion helpers and per-section timing, the reveal primitives
(`Heading`, `RevealText`, `IconPlus`), the mark, all copy (`lib/content.ts`),
and API stubs for `ui/Button`, `scene/Scene` and `game/VoidHero`.

## Builders and the files each owns

| Builder | Owns |
|---|---|
| ui-kit | `components/ui/*` (Button, Tag, InputField, Textarea, SocialLinks), `sections/Contact.tsx` |
| header | `components/chrome/Header.tsx`, `Menu.tsx`, `SmokeTransition.tsx` |
| scroll-ui | `components/chrome/ScrollIndicator.tsx`, `Scrollbar.tsx`, `ScrollTracker.tsx` |
| audio | `lib/audio/engine.ts`, `components/chrome/AudioVisualiser.tsx` |
| preloader | `components/chrome/Preloader/*`, `components/chrome/LandscapeOverlay.tsx` |
| cursor | `components/chrome/Cursor.tsx`, `components/chrome/CircleBackground.tsx` |
| scene | `components/scene/*` |
| hero | `sections/Hero.tsx`, `sections/Problem.tsx` |
| reads | `sections/Reads.tsx`, `sections/Proof.tsx` |
| evidence | `sections/Evidence.tsx` and its slider parts |
| ships | `sections/Ships.tsx`, `sections/GetIt.tsx` |
| pages | `app/privacy/*`, `app/not-found.tsx`, `components/void/*` |
| game | `components/game/*` |

The foreman owns `app/layout.tsx`, `app/page.tsx`, `components/home/HomeStage.tsx`
and the foundation, and wires everything together after the builders land.

## Links

| Link | Target | Status |
|---|---|---|
| Menu items, tick indicator, "Get ClearSign" tab | stage sections | wired in-page |
| "Repeat it yourself", "Releases", GitHub | `github.com/AnticsDecoded/clearsign` | **the repository is private**, so these 404 for visitors until it is public |
| Privacy | `/privacy` | built |
| Contact form | `mailto:` the address in `lib/content.ts` | placeholder address |
