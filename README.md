# ClearSign Website

Source for the [ClearSign website](https://clearsign-dev.github.io/clearsign.dev/). The decoder, desktop application, CLI and experimental platform live in [clearsign-dev/clearsign](https://github.com/clearsign-dev/clearsign).

## Development

Use the Node.js version in `.nvmrc` and install the locked dependencies:

```sh
npm ci
npm run dev
```

The development server runs at `http://localhost:3000`. Before submitting a change:

```sh
npm run check
```

Next.js exports static files to `out/`. GitHub Actions builds and publishes the site to GitHub Pages; `BASE_PATH` is supplied by the Pages configuration. There is no application server at request time.

## Structure

| Path | Purpose |
| --- | --- |
| `src/lib/content.ts` | Public copy and project links |
| `src/app/` | Metadata, styles, privacy page and error page |
| `src/components/sections/` | Home-page sections |
| `src/components/scene/` | Three.js scene |
| `src/lib/stage/`, `src/lib/motion/` | Scroll state and animation |
| `src/lib/audio/` | Locally synthesized audio |
| `docs/research/` | Design notes and original specifications |

Historical design briefs are not the current source for security or support claims. Check the main repository's [support matrix](https://github.com/clearsign-dev/clearsign/blob/main/docs/10-what-is-supported.md) and [verification record](https://github.com/clearsign-dev/clearsign/blob/main/docs/03-verification-status.md) before changing public copy. Do not describe a selector match as verified execution behaviour or a retrospective fixture as a prevented attack.

## Privacy and Reports

The site has no analytics or contact-data collection. Fonts are downloaded at build time and served with the site. Support links open GitHub; GitHub handles information submitted there under its own policies.

[Website issues](https://github.com/clearsign-dev/clearsign.dev/issues) belong in this repository. [Transaction-review issues](https://github.com/clearsign-dev/clearsign/issues/new/choose) and [private security reports](https://github.com/clearsign-dev/clearsign/security/advisories/new) go to the main project. Never post private keys or recovery phrases.

## Design Attribution

The layout and motion were informed by daoism.systems. The project records that its code and assets were implemented separately; the visible design credit is retained. See `docs/research/` for the design history.

## Licence

MIT OR Apache-2.0. See the licence files in this repository.
