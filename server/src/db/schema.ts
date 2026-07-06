import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { getGame } from '../games/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'cardz.db')

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    migrate(db)
    seed(db)
    seedDemoData(db)
  }
  return db
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      min_players INTEGER NOT NULL,
      max_players INTEGER NOT NULL,
      config_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL REFERENCES games(id),
      title TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed')),
      config_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      order_index INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rounds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      data_json TEXT NOT NULL DEFAULT '{}'
    );

    CREATE TABLE IF NOT EXISTS scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      round_id INTEGER NOT NULL REFERENCES rounds(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      score REAL NOT NULL,
      data_json TEXT NOT NULL DEFAULT '{}'
    );
  `)
}

function seed(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM games').get() as { cnt: number }
  if (count.cnt > 0) return

  const insert = db.prepare(
    'INSERT INTO games (slug, name, description, min_players, max_players, config_json) VALUES (?, ?, ?, ?, ?, ?)'
  )

  insert.run(
    'up-and-down',
    'Up & Down The River',
    'Trick-taking game where you bid the exact number of tricks you will win.',
    3, 7,
    JSON.stringify({ peak: 3 })
  )

  insert.run(
    'pay-me',
    'Pay Me',
    'Contract Rummy game. Lowest score after 11 rounds wins.',
    2, 6,
    JSON.stringify({})
  )
}

function seedDemoData(db: Database.Database) {
  const count = db.prepare('SELECT COUNT(*) as cnt FROM game_sessions').get() as { cnt: number }
  if (count.cnt > 0) return

  const upAndDown = getGame('up-and-down')!
  const payMe = getGame('pay-me')!

  // --- Completed Up & Down session ---
  const uadGame = db.prepare("SELECT id FROM games WHERE slug = 'up-and-down'").get() as any
  const s1 = db.prepare(
    "INSERT INTO game_sessions (game_id, title, config_json, status, created_at) VALUES (?, ?, ?, 'completed', datetime('now', '-1 day'))"
  ).run(uadGame.id, 'Friday Night Game', JSON.stringify({
    peak: 2, total_rounds: 3,
    round_configs: [],
  }))

  const uadPlayers = ['Alice', 'Bob', 'Charlie', 'Diana'].map((name, i) => {
    const r = db.prepare('INSERT INTO players (session_id, name, order_index) VALUES (?, ?, ?)').run(s1.lastInsertRowid, name, i + 1)
    return { id: Number(r.lastInsertRowid), name }
  })

  db.prepare('UPDATE game_sessions SET config_json = ? WHERE id = ?').run(JSON.stringify({
    peak: 2, total_rounds: 3,
    round_configs: [
      { round_number: 1, hand_size: 1, data: { handSize: 1, dealer_player_id: uadPlayers[0].id } },
      { round_number: 2, hand_size: 2, data: { handSize: 2, dealer_player_id: uadPlayers[1].id } },
      { round_number: 3, hand_size: 1, data: { handSize: 1, dealer_player_id: uadPlayers[2].id } },
    ],
  }), s1.lastInsertRowid)

  const uadRounds = [
    { round: 1, handSize: 1, trump: '♠', dealerIdx: 0, data: [{ bid: 1, tricks: 1 }, { bid: 0, tricks: 0 }, { bid: 1, tricks: 0 }, { bid: 0, tricks: 1 }] },
    { round: 2, handSize: 2, trump: '♥', dealerIdx: 1, data: [{ bid: 2, tricks: 2 }, { bid: 1, tricks: 1 }, { bid: 2, tricks: 1 }, { bid: 1, tricks: 2 }] },
    { round: 3, handSize: 1, trump: '♣', dealerIdx: 2, data: [{ bid: 1, tricks: 1 }, { bid: 0, tricks: 1 }, { bid: 1, tricks: 1 }, { bid: 0, tricks: 0 }] },
  ]

  for (const r of uadRounds) {
    const roundRow = db.prepare(
      'INSERT INTO rounds (session_id, round_number, data_json) VALUES (?, ?, ?)'
    ).run(s1.lastInsertRowid, r.round, JSON.stringify({ handSize: r.handSize, trump: r.trump, dealer_player_id: uadPlayers[r.dealerIdx].id }))

    const meta = { round_number: r.round, hand_size: r.handSize, data: { handSize: r.handSize, trump: r.trump } }
    const inputs = r.data.map((d, i) => ({ player_id: uadPlayers[i].id, data: d }))
    const results = upAndDown.computeScore(meta, inputs)
    for (const res of results) {
      db.prepare('INSERT INTO scores (round_id, player_id, score, data_json) VALUES (?, ?, ?, ?)').run(roundRow.lastInsertRowid, res.player_id, res.score, JSON.stringify(res.data))
    }
  }

  // --- Completed Pay Me session ---
  const pmGame = db.prepare("SELECT id FROM games WHERE slug = 'pay-me'").get() as any
  const s2 = db.prepare(
    "INSERT INTO game_sessions (game_id, title, config_json, status, created_at) VALUES (?, ?, ?, 'completed', datetime('now', '-2 hours'))"
  ).run(pmGame.id, 'Quick Pay Me', JSON.stringify({ total_rounds: 11, round_configs: [] }))

  const pmPlayers = ['Eve', 'Frank'].map((name, i) => {
    const r = db.prepare('INSERT INTO players (session_id, name, order_index) VALUES (?, ?, ?)').run(s2.lastInsertRowid, name, i + 1)
    return { id: Number(r.lastInsertRowid), name }
  })

  const roundMetas = payMe.getRounds(2)
  for (let i = 0; i < roundMetas.length; i++) {
    const rm = roundMetas[i]
    const handSize = i + 3
    const eveValue = 0
    const frankValue = i % 2 === 0 ? handSize * 3 : handSize * 2
    const dealerIdx = i % 2

    const roundRow = db.prepare('INSERT INTO rounds (session_id, round_number, data_json) VALUES (?, ?, ?)').run(s2.lastInsertRowid, rm.round_number, JSON.stringify({ ...rm.data, dealer_player_id: pmPlayers[dealerIdx].id }))
    const inputs = [
      { player_id: pmPlayers[0].id, data: { cardValue: eveValue } },
      { player_id: pmPlayers[1].id, data: { cardValue: frankValue } },
    ]
    const results = payMe.computeScore(rm, inputs)
    for (const res of results) {
      db.prepare('INSERT INTO scores (round_id, player_id, score, data_json) VALUES (?, ?, ?, ?)').run(roundRow.lastInsertRowid, res.player_id, res.score, JSON.stringify(res.data))
    }
  }

  // --- Active Up & Down session ---
  const s3 = db.prepare(
    "INSERT INTO game_sessions (game_id, title, config_json, status, created_at) VALUES (?, ?, ?, 'active', datetime('now', '-30 minutes'))"
  ).run(uadGame.id, 'Active Game', JSON.stringify({
    peak: 3, total_rounds: 5,
    round_configs: [],
  }))

  const activePlayers = ['Grace', 'Henry', 'Ivy', 'Jack', 'Kate'].map((name, i) => {
    const r = db.prepare('INSERT INTO players (session_id, name, order_index) VALUES (?, ?, ?)').run(s3.lastInsertRowid, name, i + 1)
    return { id: Number(r.lastInsertRowid), name }
  })

  // Now update session config with correct dealer IDs
  db.prepare('UPDATE game_sessions SET config_json = ? WHERE id = ?').run(JSON.stringify({
    peak: 3, total_rounds: 5,
    round_configs: [
      { round_number: 1, hand_size: 1, data: { handSize: 1, dealer_player_id: activePlayers[0].id } },
      { round_number: 2, hand_size: 2, data: { handSize: 2, dealer_player_id: activePlayers[1].id } },
      { round_number: 3, hand_size: 3, data: { handSize: 3, dealer_player_id: activePlayers[2].id } },
      { round_number: 4, hand_size: 2, data: { handSize: 2, dealer_player_id: activePlayers[3].id } },
      { round_number: 5, hand_size: 1, data: { handSize: 1, dealer_player_id: activePlayers[4].id } },
    ],
  }), s3.lastInsertRowid)

  db.prepare('INSERT INTO rounds (session_id, round_number, data_json) VALUES (?, ?, ?)').run(s3.lastInsertRowid, 1, JSON.stringify({ handSize: 1, dealer_player_id: activePlayers[0].id }))
}

export function closeDb() {
  if (db) db.close()
}
