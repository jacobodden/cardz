import { getDb, closeDb } from './db/schema.js'
import { getGame } from './games/index.js'

const db = getDb()

function seedUpAndDown() {
  const game = db.prepare("SELECT id FROM games WHERE slug = 'up-and-down'").get() as any

  // Session 1: 4 players, peak=2 (3 rounds)
  const s1 = db.prepare(
    "INSERT INTO game_sessions (game_id, title, config_json, status, created_at) VALUES (?, ?, ?, 'completed', datetime('now', '-1 day'))"
  ).run(game.id, 'Friday Night Game', JSON.stringify({ peak: 2, total_rounds: 3, round_configs: [
    { round_number: 1, hand_size: 1, data: { handSize: 1 } },
    { round_number: 2, hand_size: 2, data: { handSize: 2 } },
    { round_number: 3, hand_size: 1, data: { handSize: 1 } },
  ] }))

  const players: { id: number; name: string }[] = []
  for (const name of ['Alice', 'Bob', 'Charlie', 'Diana']) {
    const r = db.prepare(
      'INSERT INTO players (session_id, name, order_index) VALUES (?, ?, ?)'
    ).run(s1.lastInsertRowid, name, players.length + 1)
    players.push({ id: Number(r.lastInsertRowid), name })
  }

  const rounds = [
    { round: 1, handSize: 1, trump: '♠', scores: [
      { playerIdx: 0, bid: 1, tricks: 1 },
      { playerIdx: 1, bid: 0, tricks: 0 },
      { playerIdx: 2, bid: 1, tricks: 0 },
      { playerIdx: 3, bid: 0, tricks: 1 },
    ]},
    { round: 2, handSize: 2, trump: '♥', scores: [
      { playerIdx: 0, bid: 2, tricks: 2 },
      { playerIdx: 1, bid: 1, tricks: 1 },
      { playerIdx: 2, bid: 2, tricks: 1 },
      { playerIdx: 3, bid: 1, tricks: 2 },
    ]},
    { round: 3, handSize: 1, trump: '♣', scores: [
      { playerIdx: 0, bid: 1, tricks: 1 },
      { playerIdx: 1, bid: 0, tricks: 1 },
      { playerIdx: 2, bid: 1, tricks: 1 },
      { playerIdx: 3, bid: 0, tricks: 0 },
    ]},
  ]

  for (const r of rounds) {
    const roundRow = db.prepare(
      'INSERT INTO rounds (session_id, round_number, data_json) VALUES (?, ?, ?)'
    ).run(s1.lastInsertRowid, r.round, JSON.stringify({ handSize: r.handSize, trump: r.trump }))

    const gameImpl = getGame('up-and-down')!
    const roundMeta = { round_number: r.round, hand_size: r.handSize, data: { handSize: r.handSize, trump: r.trump } }
    const inputs = r.scores.map((s) => ({
      player_id: players[s.playerIdx].id,
      data: { bid: s.bid, tricks: s.tricks },
    }))
    const results = gameImpl.computeScore(roundMeta, inputs)

    for (const result of results) {
      db.prepare(
        'INSERT INTO scores (round_id, player_id, score, data_json) VALUES (?, ?, ?, ?)'
      ).run(roundRow.lastInsertRowid, result.player_id, result.score, JSON.stringify(result.data))
    }
  }

  console.log(`Up & Down completed: "${players.map((p) => p.name).join(', ')}" (${players.length} players, 3 rounds)`)
}

function seedPayMe() {
  const game = db.prepare("SELECT id FROM games WHERE slug = 'pay-me'").get() as any

  const s1 = db.prepare(
    "INSERT INTO game_sessions (game_id, title, config_json, status, created_at) VALUES (?, ?, ?, 'completed', datetime('now', '-2 hours'))"
  ).run(game.id, 'Quick Pay Me', JSON.stringify({ total_rounds: 11, round_configs: [] }))

  const players: { id: number; name: string }[] = []
  for (const name of ['Eve', 'Frank']) {
    const r = db.prepare(
      'INSERT INTO players (session_id, name, order_index) VALUES (?, ?, ?)'
    ).run(s1.lastInsertRowid, name, players.length + 1)
    players.push({ id: Number(r.lastInsertRowid), name })
  }

  const payMe = getGame('pay-me')!
  const roundMetas = payMe.getRounds(2)

  for (let i = 0; i < roundMetas.length; i++) {
    const rm = roundMetas[i]
    const handSize = i + 3
    // Eve always goes out (score 0), Frank accumulates points
    const eveValue = 0
    const frankValue = i % 2 === 0 ? handSize * 3 : handSize * 2

    const roundRow = db.prepare(
      'INSERT INTO rounds (session_id, round_number, data_json) VALUES (?, ?, ?)'
    ).run(s1.lastInsertRowid, rm.round_number, JSON.stringify(rm.data))

    const inputs = [
      { player_id: players[0].id, data: { cardValue: eveValue } },
      { player_id: players[1].id, data: { cardValue: frankValue } },
    ]
    const results = payMe.computeScore(rm, inputs)

    for (const result of results) {
      db.prepare(
        'INSERT INTO scores (round_id, player_id, score, data_json) VALUES (?, ?, ?, ?)'
      ).run(roundRow.lastInsertRowid, result.player_id, result.score, JSON.stringify(result.data))
    }
  }

  console.log(`Pay Me completed: "${players.map((p) => p.name).join(', ')}"`)
}

function seedActiveSession() {
  const game = db.prepare("SELECT id FROM games WHERE slug = 'up-and-down'").get() as any

  const s1 = db.prepare(
    "INSERT INTO game_sessions (game_id, title, config_json, status, created_at) VALUES (?, ?, ?, 'active', datetime('now', '-30 minutes'))"
  ).run(game.id, 'Active Game', JSON.stringify({ peak: 3, total_rounds: 5, round_configs: [
    { round_number: 1, hand_size: 1, data: { handSize: 1 } },
    { round_number: 2, hand_size: 2, data: { handSize: 2 } },
    { round_number: 3, hand_size: 3, data: { handSize: 3 } },
    { round_number: 4, hand_size: 2, data: { handSize: 2 } },
    { round_number: 5, hand_size: 1, data: { handSize: 1 } },
  ] }))

  const players: { id: number; name: string }[] = []
  for (const name of ['Grace', 'Henry', 'Ivy', 'Jack', 'Kate']) {
    const r = db.prepare(
      'INSERT INTO players (session_id, name, order_index) VALUES (?, ?, ?)'
    ).run(s1.lastInsertRowid, name, players.length + 1)
    players.push({ id: Number(r.lastInsertRowid), name })
  }

  // Create round 1 (first round, not yet played)
  db.prepare(
    'INSERT INTO rounds (session_id, round_number, data_json) VALUES (?, ?, ?)'
  ).run(s1.lastInsertRowid, 1, JSON.stringify({ handSize: 1 }))

  console.log(`Active session: "${players.map((p) => p.name).join(', ')}" (round 1 ready)`)
}

seedUpAndDown()
seedPayMe()
seedActiveSession()

closeDb()
console.log('Seed complete')
