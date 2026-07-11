Card game info can be found under @docs/games

## Tech stack
- **Client**: Vite + React 19 + Tailwind CSS v4
- **Server**: Express + SQLite (being phased out — see Architecture Decision below)
- **Client-side DB**: Dexie.js + IndexedDB (replacing Express+SQLite for storage)
- **Tailwind v4**: Configuration is done via CSS `@theme` directives (no `tailwind.config.*`). Custom dark mode variant is defined in `src/index.css`: `@custom-variant dark (&:where(.dark, .dark *));`. Theme preference is stored in `localStorage('theme')` and the `.dark` class is toggled on `<html>`.
- **Build**: `npm run build` (runs `tsc -b && vite build`)

## Architecture Decision — Client-only Dexie/IndexedDB

### Decision
Move all data persistence from server-side Express + SQLite to local-only IndexedDB via Dexie.js. The server will be removed entirely (no sync, no multi-device, no multiplayer).

### Rationale
- Multi-device / multiplayer is not a goal
- Eliminates the server process, deployment complexity, CORS, and the client-server round-trip for every operation
- Dexie's schema versioning, query builder, and `useLiveQuery` hook map cleanly onto the relational data model (sessions → players → rounds → scores)
- Full offline capability with no infrastructure

### Replaced components
| Before | After |
|--------|-------|
| Express server + `better-sqlite3` | Removed entirely |
| `src/api/client.ts` (fetch wrapper) | Replaced with Dexie table operations |
| `server/src/routes/sessions.ts` (CRUD + game logic) | Moved to `src/db/` + `src/games/` |
| `server/src/games/` (scoring logic) | Moved to `src/games/` (pure functions, no change needed) |
| `server/src/db/schema.ts` (SQL schema) | Replaced with Dexie `db.version().stores()` |

## Database Schema (Dexie)

```
cardz DB (Dexie)
├── games        │ id, slug, name, description, min_players, max_players, config_schema
├── sessions     │ id, game_id, title, status, config_json, created_at
├── players      │ id, session_id, name, order_index            │ index: session_id
├── rounds       │ id, session_id, round_number, data_json       │ index: session_id
└── scores       │ id, round_id, player_id, score, data_json     │ index: round_id
```

All numeric IDs auto-increment via Dexie's `++id` syntax.

## Migration steps

### Phase 1 — Foundation &#10003;
- [x] `npm install dexie dexie-react-hooks`
- [x] Create `src/db/dexie-db.ts` — Dexie DB subclass with schema definition
- [x] Create `src/db/seed.ts` — seed game definitions into the `games` table
- [x] Copy scoring logic from `server/src/games/` to `src/games/` (pure functions, no DB deps)

### Phase 2 — Data access layer &#10003;
- [x] Create `src/db/sessions.ts` — Dexie-based CRUD helpers for sessions+players
  - `listSessions()` — joins sessions with games, ordered by created_at DESC
  - `getSession(id)` — returns session with game + players + total_rounds
  - `createSession(game_id, title?)` — inserts session, returns new record
  - `addPlayer(sessionId, name)` — inserts player with auto-incrementing order_index
  - `removePlayer(sessionId, playerId)` — deletes player
  - `startSession(sessionId, config)` — generates rounds via game impl, stores config, creates first round
- [x] Create `src/db/rounds.ts` — Dexie-based round + score operations
  - `getCurrentRound(sessionId)` — finds first unscored round, returns with schema fields
  - `submitRound(sessionId, roundData)` — hook rule validation, score computation, score insertion, next round creation
  - `getScoreboard(sessionId)` — builds per-player per-round score table
- [x] Replace `api/client.ts` calls in all page components with Dexie operations

### Phase 3 — Component updates &#10003;
- [x] Update `HomePage.tsx` — list sessions via Dexie instead of `api.listSessions()`
- [x] Update `NewSessionPage.tsx` — create session + players via Dexie
- [x] Update `SessionPage.tsx` — load scoreboard, get current round, submit round via Dexie

### Phase 4 — Server removal &#10003;
- [x] Delete `server/` directory
- [x] Remove server scripts from root `package.json` (rewrote to only `dev`, `build`, `lint` — all prefixed to client)
- [x] Remove Vite proxy config (`/api` → `localhost:3001` removed from `vite.config.ts`)
- [x] Remove unused `concurrently` dependency
- [x] Clean up root `node_modules` / `package-lock.json`
- [x] Verify `npm run build` and `npm run dev` work standalone

### Phase 5 — Cleanup &#10003;
- [x] Remove `api/client.ts` entirely
- [x] Remove unused server dependencies from root `package.json` (rewrote to only `dev`, `build`, `lint` — all prefixed to client)
- [x] Update `README.md` with current project description
- [x] Run `npm run build` to verify clean build

## Key conventions
- Dexie schema strings follow the format: `'++id, field1, field2'` — `++id` means auto-increment primary key
- All Dexie DB interactions go through the singleton `db` instance exported from `src/db/dexie-db.ts`
- Game scoring logic remains as pure functions with no side effects (same as server implementation)
- Use `useLiveQuery` from `dexie-react-hooks` instead of manual `useEffect` + fetch for reactive data loading
