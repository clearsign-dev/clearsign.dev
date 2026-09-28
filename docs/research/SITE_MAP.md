# Site map

What the reference (the 2026 daoism.systems, live at `daoism-v2.vercel.app`)
consists of, and what each part became.

| Reference path | Type | Found in | Auth | Here |
|---|---|---|---|---|
| `/` | landing (the stage, 8 sections) | sitemap, nav | no | `/`, rebuilt |
| `/privacy-policy` | legal | footer | no | `/privacy`, rebuilt |
| any unknown path | 404, with a hidden rhythm game | route | no | `not-found.tsx`, rebuilt |
| `/_octagon` | showreel of the 3D octagon, `noindex` | code only | no | not built |
| `/api/send` | contact form endpoint (Resend) | code only | — | not built; UI-only, the form opens a `mailto:` |
| x.com, t.me, paragraph.com | socials | header menu, footer | — | replaced by the GitHub repository |

## In-page navigation

The reference has no other pages: its menu, tick indicator and "Connect Now"
tab all move the stage to a section. The same is true here, so every in-site
link is either a stage jump or one of the two routes above.

## Authentication

None on the reference, none needed by the PRD.
