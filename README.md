# The ClearSign site

The public site for ClearSign. Its design is the 2026 daoism.systems (live at
`daoism-v2.vercel.app`): the same layout, section anatomy, motion and 3D
technique, wearing ClearSign's mark, colour, type and words. Every word comes
from `../docs/website-brief.md`, and nothing on the page claims what the brief
says must never be claimed.

## Running it

```sh
npm install
npm run dev      # http://localhost:3000
npm run build    # a static site in out/, for any static host
```

There is no server and nothing runs at request time. `out/` is plain files:
`index.html`, `privacy/index.html` and `404.html`. A host that serves
`404.html` for unknown paths (GitHub Pages, Netlify, Vercel, Cloudflare Pages,
S3 with an error document) gets the 404 page and its game for free.

Two query strings help when looking at it: `?preloader=off` skips the loading
gate, and in development `window.__stage.jump(0.5)` moves the stage without
easing (it is not in production builds).

## How the home page works

It is a stage, not a document. A fixed viewport sits over an invisible scroll
track 8000px tall (1.5× that on touch), eased by Lenis with the reference's
tuning. One progress value picks which of eight full-screen sections is
showing and how far through it the visitor is, and every reveal in every
section is a pure function of that, so scrolling back plays it all backwards.
`docs/research/PAGE_TOPOLOGY.md` has the layers and the timeline.

| # | Section | Built on the reference's |
|---|---|---|
| 0 | See exactly what you are about to sign | Hero |
| 1 | Nobody reads the bytes | About |
| 2 | What it reads | Services (hover-to-explore hotspots; cards on phones) |
| 3 | It caught Bybit | Collaboration, plus the real Bybit record and ClearSign's verdict |
| 4 | The evidence | Blog, its 3D slider rebuilt in the DOM |
| 5 | How it ships | Partners (a column of cards) |
| 6 | Run it before you approve | Process, with the brief's standing warning beside the steps |
| 7 | Tell us what it missed | Contact |

Behind the sections, `src/components/scene/` draws the ClearSign mark the way
the reference draws its octagon: the C as rings of segmented rods and the S as
a tube, each made of points, with chromatic fringing and a fog pass, moving
from state to state as the page scrolls. It holds 60 frames a second at
1440×900 and steps its own quality down on slower machines.

## Where things are

```
src/app/                 layout (fonts, tokens), the home page, /privacy, 404
src/lib/content.ts       every word on the site
src/lib/stage/           the scroll stage: section timeline, stores, layout flags
src/lib/motion/          progress curves, easings, and each section's choreography
src/lib/audio/           the synthesised sound (Web Audio; nothing is downloaded)
src/components/stage/    the stage itself and the intro sequencer
src/components/reveal/   the per-letter heading reveal and the paragraph reveal
src/components/chrome/   header, menu, preloader, tick ruler, tracker, cursor, circles, sound
src/components/sections/ the eight sections (their parts live in sibling folders)
src/components/scene/    the Three.js scene
src/components/void/     the 404 page
src/components/game/     the rhythm game behind the Konami code on the 404
docs/research/           intake, brand decisions, site map, topology, and a spec per component
```

The brand lives in two places only: the tokens at the top of
`src/app/globals.css` and the fonts in `src/app/layout.tsx`.
`docs/research/BRAND.md` says what replaced what and why.

## About the reference

The reference's source is public but has no licence, so it was read for
values and behaviour only. None of its code, models, textures, sounds, fonts
or logo is here: the scene, the smoke transition, the preloader grid, the
404's lighting and every sound are generated in code. Screenshots of the
reference in `docs/design-references/` are kept out of git. The contact
panel carries a small "Layout after daoism.systems" credit.

## Privacy

The site sets no cookies, runs no analytics and makes no request to any other
host; the fonts are downloaded at build time and served from here. A
production run through every section recorded no request to anything but the
site itself. Keep it that way, or change what `/privacy` says.

## Before it goes public

| | |
|---|---|
| **The repository is private** | "Repeat it yourself", "Releases" and the GitHub icon link to `github.com/AnticsDecoded/clearsign`, which visitors cannot open until it is public |
| **The contact address** | `CONTACT_EMAIL` in `src/lib/content.ts` is `hello@clearsign.dev`, which does not exist yet. The form opens the visitor's mail client addressed to it |
| **Downloads** | The Get it section points at the releases page; point it at signed installers once there are some |
| **A social preview image** | There is no `og:image` yet; a 1200×630 PNG would render when the link is shared |
| **A listen** | The drone and interface sounds are synthesised with levels set by ear on paper; they need a listen on real speakers. The knobs are at the top of `src/lib/audio/engine.ts` |
