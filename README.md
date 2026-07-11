# Cardz

A local-first, installable PWA card game scorekeeper. Track sessions, players, rounds, and scores for your favorite card games.

[Hosted on GitHub Pages](https://jodden.github.io/cardz/) — all data stays in your browser (IndexedDB via Dexie.js).

## Stack

- **Frontend**: Vite + React 19 + Tailwind CSS v4
- **Storage**: Dexie.js + IndexedDB (local-only, no server)
- **Installable**: PWA with service worker for offline use
- **No server, no sync, no sign-in** — all data stays in your browser.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server at `localhost:5173` |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run lint` | Run oxlint |

## Architecture

All data lives in IndexedDB via Dexie.js in five object stores:

```
games → sessions → players → rounds → scores
```

Game scoring logic (pure functions) lives in `src/games/`. Data access helpers live in `src/db/`. Components use `useLiveQuery` from `dexie-react-hooks` for reactive data loading.

## Games

- [**Up & Down The River**](docs/games/UpAndDown.md) — Trick-taking game where you bid the exact number of tricks you will win.
- [**Pay Me**](docs/games/PayMe.md) — Contract Rummy game. Lowest score after 11 rounds wins.
