# Cardz

A local-first, installable PWA card game scorekeeper. Track sessions, players, rounds, and scores for your favorite card games.

[Hosted on GitHub Pages](https://jacobodden.github.io/cardz/). No server, no sync, no sign-in: all data stays in your browser (IndexedDB via Dexie.js).

## Games

- [**Up and Down the River**](docs/games/up-and-down.html): trick-taking; bid the exact number of tricks you will win. Highest total wins.
- [**Pay Me**](docs/games/pay-me.html): Contract Rummy over 11 rounds. Lowest total wins.
- [**High Score**](docs/games/high-score.html): open-ended points for any game where the highest total wins.
- [**Low Score**](docs/games/low-score.html): open-ended points for any game where the lowest total wins.

## Design

The UI is the **Card Table** design: a felt band across the top holds the page title and the current round, with the standings and score entry below it on the table. It is built for phones first and also works on desktop.

- **Light and dark mode**: follows the system by default; the moon/sun button in the header switches it.
- **Color themes**: Felt (green) and Midnight (violet), picked from the palette button in the header. Mode and theme are independent and remembered on the device.
- **Design history**: dated screenshots of how the app has looked over time live in [docs/design-history](docs/design-history/index.html).

## Stack

- **Frontend**: Vite + React 19 + Tailwind CSS v4
- **Storage**: Dexie.js + IndexedDB (local-only)
- **Installable**: PWA with a service worker for offline use
- **Tests**: Vitest (unit) and Playwright (e2e and visual)

See [docs/architecture.html](docs/architecture.html) for how it fits together.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server at `localhost:5173` |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Run oxlint |
| `npm run test:unit` | Unit tests (Vitest) |
| `npm run test:unit:watch` | Unit tests in watch mode |
| `npm run test:e2e` | Functional tests (Playwright, phone and desktop) |
| `npm run test:visual` | Screenshot tests, inside the Playwright container (needs podman or docker) |
| `npm run test:visual:update` | Accept intentional screenshot changes, also in the container |
| `npm test` | All Playwright tests on the host (visual ones may differ from the container baselines) |
| `npm run test:ui` | Playwright UI mode |
| `npm run design:capture` | Capture a dated design-history milestone |
| `npm run design:index` | Rebuild the design-history page without capturing |
| `npm run generate-pwa-assets` | Regenerate install icons and favicons from `public/pwa-icon.png` |

CI (`.github/workflows/test.yml`) runs lint, unit, build and e2e tests, plus the visual tests in the same container image, on every pull request.

## Docs

Start at [docs/index.html](docs/index.html): game rules, architecture, design history and earlier planning notes. Open the files in a browser; they follow your system's light or dark setting.
