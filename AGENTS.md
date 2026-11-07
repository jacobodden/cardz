Card game rules (HTML; read them as text):
- @docs/games/up-and-down.html
- @docs/games/pay-me.html
- @docs/games/high-score.html
- @docs/games/low-score.html

Docs live in `docs/` as HTML sharing `docs/assets/docs.css` (Felt tokens, light and dark); start at `docs/index.html`, see `docs/architecture.html` for the overview. Keep docs in HTML: no Markdown under `docs/`. Add a rules page under `docs/games/` (and link it from `docs/games/index.html` and `README.md`) when adding a game.

## Tech stack

- **Client**: Vite + React 19 + Tailwind CSS v4
- **Storage**: Dexie.js + IndexedDB (local-only, no server, no sync, no sign-in)
- **PWA**: `vite-plugin-pwa` with auto-updating service worker
- **Hosting**: GitHub Pages at `/cardz/` base path
- **Build**: `npm run build` (runs `tsc -b && vite build`)
- **Tests**: `npm run test:unit` (Vitest + fake-indexeddb, `tests/unit/`), `npm run test:e2e` / `npm run test:visual` (Playwright). Visual tests run inside the pinned Playwright container (`scripts/playwright-container.sh`, podman or docker), the same image as CI, so baselines match; update them with `npm run test:visual:update`, never with a host run.
- **Lint**: `npm run lint` (oxlint), also run in CI

## PWA

Configured in `vite.config.ts` via `VitePWA` plugin. Manifest has static `theme_color` and `background_color`; the `<meta name="theme-color">` tag is updated at runtime by `Layout.tsx` to the current theme's `--felt` (it follows the theme and dark/light mode).

Installed on iOS, the app draws under a transparent status bar (`apple-mobile-web-app-status-bar-style: black-translucent`, `viewport-fit=cover` in `index.html`). The header in `Layout.tsx` is always felt, sticky at the top and padded by `env(safe-area-inset-top)`, so the status bar shows the theme's felt with no seam and white status text stays readable. Page gutters use the `safe-x` utility (`src/index.css`) to clear the notch in landscape; `<html>`'s felt/page split background makes top overscroll felt. Keep the header felt in every theme: the status bar text is always white.

App icons managed via `@vite-pwa/assets-generator` (`npm run generate-pwa-assets`). Icons: `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`. The header logo is a separate transparent image, `public/app-logo.png`.

The viewport meta allows pinch-zoom. Keep form controls at 16px text or larger so iOS doesn't auto-zoom on focus (an e2e test checks this).

## Dark mode

Custom variant defined in `src/index.css`:
```css
@custom-variant dark (&:where(.dark, .dark *));
```
Theme preference is stored in `localStorage('theme')` and the `.dark` class is toggled on `<html>`. The toggle lives in `src/components/Layout.tsx`, which also updates `<meta name="theme-color">` for the browser chrome.

## Color themes

Themes are separate from light/dark. `src/themes.ts` lists them (id, name, swatch, theme-color per mode); each theme's tokens live in `src/index.css` under `:root[data-palette="<id>"]` and `:root.dark[data-palette="<id>"]`. The choice is stored in `localStorage('palette')`; unknown ids fall back to `felt`. `index.html`'s startup script applies the theme and mode before first paint, using the registry that `vite.config.ts` injects in place of `__THEMES__`. The picker is `src/components/ThemePicker.tsx`. A theme can also set `logo`, `suitArt` and `celebration` (what bursts from the trophy when a game ends: `confetti` by default, `seeds`, `footballs`; see `src/celebration/particles.ts`). To add a theme, add a registry entry and both token blocks; `tests/unit/themes.test.ts` checks they exist, match the registry, and that text pairs pass 4.5:1 contrast. Add visual snapshots for the new theme too.

## Database Schema (Dexie)

Defined in `src/db/dexie-db.ts` — `CardzDB` extends `Dexie` with five tables:

```
cardz DB (Dexie)
├── games        │ ++id, &slug, name, description, min_players, max_players, config_schema
├── sessions     │ ++id, game_id, title, status, config_json, created_at
├── players      │ ++id, session_id, name, order_index            │ index: session_id
├── rounds       │ ++id, session_id, round_number, data_json       │ index: session_id
└── scores       │ ++id, round_id, player_id, score, data_json     │ index: round_id
```

Game definitions (name, description, player limits, config schema) live in the game modules under `src/games/`. `src/db/seed.ts` upserts them into the `games` table by slug on every load, so code changes reach installed copies.

## Routing and pages

| Route | Component | File |
|-------|-----------|------|
| `/` | `HomePage` | `src/pages/HomePage.tsx` |
| `/sessions/new` | `NewSessionPage` | `src/pages/NewSessionPage.tsx` |
| `/sessions/:id` | `SessionPage` | `src/pages/SessionPage.tsx` |

All routes use `BrowserRouter` with `basename={import.meta.env.BASE_URL}` to support the `/cardz/` subpath on GitHub Pages.

## GitHub Pages deployment

Workflow at `.github/workflows/deploy.yml` triggers on push to `main`. Uses `actions/upload-pages-artifact@v5` with `path: './dist'`. Requires Pages to be enabled on the repo (Settings → Pages → Source: GitHub Actions).

## Key conventions

- Dexie schema strings follow the format: `'++id, field1, field2'` — `++id` means auto-increment primary key
- All Dexie DB interactions go through the singleton `db` instance exported from `src/db/dexie-db.ts`
- Game scoring logic lives in `src/games/` as pure functions with no side effects
- Data access helpers live in `src/db/` (e.g. `sessions.ts`, `rounds.ts`)
- Unit tests for `src/games/` and `src/db/` live in `tests/unit/`; DB tests call `resetDb()` from `tests/unit/db-helpers.ts`, which awaits `dbReady` before clearing tables
- Components use `useLiveQuery` from `dexie-react-hooks` instead of manual `useEffect` + fetch
- Tailwind v4 uses CSS `@theme` directives — no `tailwind.config.*` file
