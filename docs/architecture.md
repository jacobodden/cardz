# Cardz — Architecture & Plan

## Overview
Webapp for creating scoreboards for family card games. Track rounds, scores, and standings per game session.

## Tech Stack
- **Frontend**: React + Vite (SPA) + Tailwind CSS
- **Backend**: Express (Node.js / TypeScript)
- **Database**: SQLite via `better-sqlite3`
- **Deployment (future)**: AWS free tier (EC2 or Elastic Beanstalk)

## Project Layout
```
cardz/
├── client/                  # Vite + React
│   ├── src/
│   │   ├── pages/           # Route-level page components
│   │   ├── components/      # Shared UI components
│   │   └── api/             # API client hooks
│   ├── index.html
│   └── package.json
├── server/
│   ├── src/
│   │   ├── routes/          # Express route handlers
│   │   ├── db/              # Schema, migrations, seed
│   │   ├── games/           # Game scoring engine
│   │   │   ├── types.ts     # CardGame interface
│   │   │   ├── upanddown.ts
│   │   │   ├── payme.ts
│   │   │   └── index.ts     # Game registry
│   │   └── index.ts         # Express app entry
│   └── package.json
├── docs/
│   └── architecture.md
└── package.json             # Root scripts (dev, build, start)
```

## Data Model (SQLite)

```
games
  id            INTEGER PRIMARY KEY
  slug          TEXT UNIQUE NOT NULL     — "up-and-down", "pay-me"
  name          TEXT NOT NULL
  description   TEXT
  min_players   INTEGER NOT NULL
  max_players   INTEGER NOT NULL
  config_json   TEXT                     — default config blob

game_sessions
  id            INTEGER PRIMARY KEY
  game_id       INTEGER → games.id
  title         TEXT
  status        TEXT NOT NULL DEFAULT 'active'   — active | completed
  created_at    TEXT DEFAULT (datetime('now'))
  config_json   TEXT                     — overridden config (e.g. custom peak)

players
  id            INTEGER PRIMARY KEY
  session_id    INTEGER → game_sessions.id
  name          TEXT NOT NULL
  order_index   INTEGER NOT NULL

rounds
  id            INTEGER PRIMARY KEY
  session_id    INTEGER → game_sessions.id
  round_number  INTEGER NOT NULL
  data_json     TEXT                     — round metadata (e.g. {handSize, trump})

scores
  id            INTEGER PRIMARY KEY
  round_id      INTEGER → rounds.id
  player_id     INTEGER → players.id
  score         REAL NOT NULL
  data_json     TEXT                     — raw inputs (e.g. {bid, tricks}, {cardValue})
```

## Game Scoring Engine

Each game module implements:
```typescript
interface CardGame {
  slug: string;
  getRounds(playerCount: number, config?: any): RoundMeta[];
  getRoundSchema(round: number): InputField[];
  computeScore(roundMeta: RoundMeta, inputs: PlayerScoreInput[]): PlayerScoreResult[];
}
```

- `Up & Down River`: rounds peak at `floor(51/players)`, total rounds = peak*2-1. Score = 10+tricks if bid==tricks, else 0. Round stores handSize and trump suit.
- `Pay Me`: 11 rounds, hand sizes 3→13. Score = sum of card values left in hand (face=10, ace=1, number=face). Configurable wild card per round.

## API Endpoints

```
GET    /api/games                       → list games
POST   /api/sessions                    → create session {gameId, title?, config?}
GET    /api/sessions/:id                → session detail (with players, rounds)
PATCH  /api/sessions/:id                → update session (e.g. complete)
POST   /api/sessions/:id/players        → add player {name}
DELETE /api/sessions/:id/players/:pid   → remove player
POST   /api/sessions/:id/start          → lock players, generate rounds
GET    /api/sessions/:id/rounds         → list rounds (with input schema for current)
POST   /api/sessions/:id/rounds/:r      → submit scores for round
GET    /api/sessions/:id/scoreboard     → full standings
```

## Frontend Routes

```
/                        Home — list active sessions, create new
/sessions/new            New session — pick game, add players, start
/sessions/:id            Session — scoreboard + current round input
```

## Implementation Phases

1. **Scaffold** — Vite+React+Tailwind, Express+SQLite, dev scripts
2. **Database** — schema + seed for game definitions
3. **Game Engine** — interface, Up&Down, Pay Me implementations
4. **API Routes** — all endpoints listed above
5. **Frontend** — all pages and components

## Future Considerations
- User accounts / auth (add users table, FK to sessions)
- AWS deployment (EC2, S3 static assets, Route53)
- More games (implement CardGame interface)
- Real-time sync (WebSockets for shared sessions)
