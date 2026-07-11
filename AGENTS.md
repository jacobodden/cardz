Card game info can be found under @docs/games

## Tech stack

- **Client**: Vite + React 19 + Tailwind CSS v4
- **Storage**: Dexie.js + IndexedDB (local-only, no server, no sync, no sign-in)
- **PWA**: `vite-plugin-pwa` with auto-updating service worker
- **Hosting**: GitHub Pages at `/cardz/` base path
- **Build**: `npm run build` (runs `tsc -b && vite build`)

## PWA

Configured in `vite.config.ts` via `VitePWA` plugin. Manifest has static `theme_color` and `background_color`; the `<meta name="theme-color">` tag is updated dynamically at runtime by `Layout.tsx` when toggling dark/light mode.

App icons managed via `@vite-pwa/assets-generator` (`npm run generate-pwa-assets`). Icons: `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`.

## Dark mode

Custom variant defined in `src/index.css`:
```css
@custom-variant dark (&:where(.dark, .dark *));
```
Theme preference is stored in `localStorage('theme')` and the `.dark` class is toggled on `<html>`. The toggle lives in `src/components/Layout.tsx`, which also updates `<meta name="theme-color">` for the browser chrome.

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

Seed data (game definitions) loaded in `src/db/seed.ts`.

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
- Components use `useLiveQuery` from `dexie-react-hooks` instead of manual `useEffect` + fetch
- Tailwind v4 uses CSS `@theme` directives — no `tailwind.config.*` file
