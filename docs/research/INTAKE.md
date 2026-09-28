# Intake

| | |
|---|---|
| Build mode | **UI-only**: a static Next.js frontend, no backend. The contact form opens the reader's mail client. |
| Design mode | **Rebrand**: daoism.systems' structure, layout, section anatomy and motion, wearing ClearSign's mark, colour and type. |
| Reference | The **2026** daoism.systems (Awwwards Honorable Mention, 31 July 2026). Live at `https://daoism-v2.vercel.app/`; the custom domain times out. Source is public at `github.com/daoism-systems/daoism.systems` with **no licence**, so it is read for values and behaviour only. None of its code, models, textures, sounds, fonts or logo ships here. |
| Not the reference | The 2023 daoism.systems (yellow, Russo One) that the dropped first site reconstructed from the Internet Archive. It is a different design. |
| PRD | `../../docs/website-brief.md` in the repository root, copied to `PRD.md` beside this file. |

## Product

ClearSign reads a blockchain transaction from the raw bytes and says what those
bytes do before anyone approves them. It has no network access, holds no keys
and signs nothing. It adds one step before approving.

## Pages

| Route | What it is |
|---|---|
| `/` | The stage: eight full-screen sections driven by one scroll timeline |
| `/privacy` | The reference's privacy-policy layout, saying what this site does not do |
| 404 | The reference's 404 treatment, with its hidden game behind the Konami code |

## Content and branding overrides

Every word comes from the brief. Every number is one the brief lists as safe
(Part 11). The brief's "never claim" list is binding: no audit badge, no users,
no partners, no hardware, no EIP-712.

## Gaps

- The reference's hero, services, process and blog imagery is a 3D scene built
  from its own models. That is replaced by a ClearSign scene: the mark rendered as
  particles with the same point-sprite, chromatic-aberration and fog treatment.
- The reference's ambient music and interface sounds are its own recordings.
  Sound here is synthesised in the browser with Web Audio, so nothing is loaded.
- The reference's display face (KH Interference, a trial licence) is replaced
  by IBM Plex Mono.
- The reference has partners and a blog. ClearSign has neither, and the brief
  forbids implying partners. Those two sections carry "how it ships" and "the
  evidence" instead.
