import { Router } from 'express'
import { getDb } from '../db/schema.js'
import { getGame } from '../games/index.js'

const router = Router()

type CreateSessionBody = {
  game_id: number
  title?: string
  config?: Record<string, any>
}

router.post('/', (req, res) => {
  const db = getDb()
  const { game_id, title, config } = req.body as CreateSessionBody

  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(game_id) as any
  if (!game) return res.status(404).json({ error: 'Game not found' })

  const result = db.prepare(
    'INSERT INTO game_sessions (game_id, title, config_json) VALUES (?, ?, ?)'
  ).run(game_id, title ?? null, JSON.stringify(config ?? {}))

  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(session)
})

router.get('/', (req, res) => {
  const db = getDb()
  const sessions = db.prepare(
    'SELECT s.*, g.name as game_name, g.slug as game_slug FROM game_sessions s JOIN games g ON g.id = s.game_id ORDER BY s.created_at DESC'
  ).all()
  res.json(sessions)
})

router.get('/:id', (req, res) => {
  const db = getDb()
  const sessionId = Number(req.params.id)

  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId) as any
  if (!session) return res.status(404).json({ error: 'Session not found' })

  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(session.game_id)
  const players = db.prepare('SELECT * FROM players WHERE session_id = ? ORDER BY order_index').all(sessionId)

  const config = JSON.parse(session.config_json || '{}')

  res.json({ ...session, game, players, total_rounds: config.total_rounds ?? null })
})

type UpdateSessionBody = {
  status?: string
  title?: string
}

router.patch('/:id', (req, res) => {
  const db = getDb()
  const { status, title } = req.body as UpdateSessionBody

  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(Number(req.params.id)) as any
  if (!session) return res.status(404).json({ error: 'Session not found' })

  if (status) {
    db.prepare('UPDATE game_sessions SET status = ? WHERE id = ?').run(status, session.id)
  }
  if (title !== undefined) {
    db.prepare('UPDATE game_sessions SET title = ? WHERE id = ?').run(title, session.id)
  }

  const updated = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(session.id)
  res.json(updated)
})

type AddPlayerBody = {
  name: string
}

router.post('/:id/players', (req, res) => {
  const db = getDb()
  const { name } = req.body as AddPlayerBody
  const sessionId = Number(req.params.id)

  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId) as any
  if (!session) return res.status(404).json({ error: 'Session not found' })
  if (session.status !== 'active') return res.status(400).json({ error: 'Session is not active' })

  const maxOrder = db.prepare(
    'SELECT COALESCE(MAX(order_index), 0) as mx FROM players WHERE session_id = ?'
  ).get(sessionId) as { mx: number }

  const result = db.prepare(
    'INSERT INTO players (session_id, name, order_index) VALUES (?, ?, ?)'
  ).run(sessionId, name, maxOrder.mx + 1)

  const player = db.prepare('SELECT * FROM players WHERE id = ?').get(result.lastInsertRowid)
  res.status(201).json(player)
})

router.delete('/:id/players/:pid', (req, res) => {
  const db = getDb()
  const sessionId = Number(req.params.id)
  const playerId = Number(req.params.pid)

  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId) as any
  if (!session) return res.status(404).json({ error: 'Session not found' })

  db.prepare('DELETE FROM players WHERE id = ? AND session_id = ?').run(playerId, sessionId)
  res.status(204).end()
})

type StartSessionBody = {
  config?: Record<string, any>
}

router.post('/:id/start', (req, res) => {
  const db = getDb()
  const sessionId = Number(req.params.id)
  const { config } = (req.body ?? {}) as StartSessionBody

  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId) as any
  if (!session) return res.status(404).json({ error: 'Session not found' })
  if (session.status !== 'active') return res.status(400).json({ error: 'Session already started' })

  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(session.game_id) as any
  const players = db.prepare('SELECT * FROM players WHERE session_id = ? ORDER BY order_index').all(sessionId) as any[]
  if (players.length === 0) return res.status(400).json({ error: 'Need at least one player' })

  const gameImpl = getGame(game.slug)
  if (!gameImpl) return res.status(500).json({ error: 'Game implementation not found' })

  const gameDefaults = JSON.parse(game.config_json || '{}')
  const mergedConfig = { ...gameDefaults, ...JSON.parse(session.config_json || '{}'), ...config }
  const allRounds = gameImpl.getRounds(players.length, mergedConfig)

  const firstDealerIndex = mergedConfig.first_dealer_index ?? 0
  const roundConfigs = allRounds.map((r, i) => {
    const dealerIdx = (firstDealerIndex + i) % players.length
    return {
      round_number: r.round_number,
      hand_size: r.hand_size,
      data: { ...r.data, dealer_player_id: players[dealerIdx].id },
    }
  })

  const newConfig = { ...mergedConfig, total_rounds: allRounds.length, round_configs: roundConfigs }

  db.prepare('UPDATE game_sessions SET config_json = ? WHERE id = ?').run(JSON.stringify(newConfig), sessionId)

  const updated = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId)

  // Generate first round
  const firstRoundData = roundConfigs[0].data
  db.prepare(
    'INSERT INTO rounds (session_id, round_number, data_json) VALUES (?, ?, ?)'
  ).run(sessionId, 1, JSON.stringify(firstRoundData))

  res.status(200).json(updated)
})

router.get('/:id/rounds', (req, res) => {
  const db = getDb()
  const sessionId = Number(req.params.id)

  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId) as any
  if (!session) return res.status(404).json({ error: 'Session not found' })

  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(session.game_id) as any
  const gameImpl = getGame(game.slug)
  if (!gameImpl) return res.status(500).json({ error: 'Game implementation not found' })

  const config = JSON.parse(session.config_json || '{}')
  const totalRounds = config.total_rounds ?? 0

  // Find the next unscored round
  const scoredRounds = db.prepare(`
    SELECT r.round_number FROM rounds r
    JOIN scores s ON s.round_id = r.id
    WHERE r.session_id = ?
    GROUP BY r.id
  `).all(sessionId) as any[]

  const scoredNumbers = new Set(scoredRounds.map((r: any) => r.round_number))
  const allRounds = db.prepare(
    'SELECT * FROM rounds WHERE session_id = ? ORDER BY round_number'
  ).all(sessionId) as any[]

  // Find the first created round without scores
  const currentRound = allRounds.find((r: any) => !scoredNumbers.has(r.round_number))

  if (!currentRound) {
    // Game might be complete or we need to check if there are more rounds
    const totalCreated = allRounds.length
    if (totalCreated >= totalRounds) {
      return res.json({ complete: true })
    }
    return res.json({ complete: true })
  }

  const data = JSON.parse(currentRound.data_json || '{}')
  const roundMeta = {
    round_number: currentRound.round_number,
    hand_size: data.handSize ?? 0,
    data,
  }

  const fields = gameImpl.getRoundSchema(roundMeta)

  res.json({
    round_number: currentRound.round_number,
    data_json: currentRound.data_json,
    fields,
  })
})

type SubmitRoundBody = {
  round_data?: Record<string, any>
  scores: { player_id: number; data: Record<string, any> }[]
}

router.post('/:id/rounds', (req, res) => {
  const db = getDb()
  const sessionId = Number(req.params.id)
  const { round_data, scores: rawScores } = req.body as SubmitRoundBody

  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId) as any
  if (!session) return res.status(404).json({ error: 'Session not found' })

  const game = db.prepare('SELECT * FROM games WHERE id = ?').get(session.game_id) as any
  const gameImpl = getGame(game.slug)
  if (!gameImpl) return res.status(500).json({ error: 'Game implementation not found' })

  const config = JSON.parse(session.config_json || '{}')
  const totalRounds = config.total_rounds ?? 0
  const roundConfigs: { round_number: number; hand_size: number; data: Record<string, any> }[] = config.round_configs ?? []

  // Find current unscored round
  const scoredRounds = db.prepare(`
    SELECT r.round_number FROM rounds r
    JOIN scores s ON s.round_id = r.id
    WHERE r.session_id = ?
    GROUP BY r.id
  `).all(sessionId) as any[]

  const scoredNumbers = new Set(scoredRounds.map((r: any) => r.round_number))
  const allRounds = db.prepare(
    'SELECT * FROM rounds WHERE session_id = ? ORDER BY round_number'
  ).all(sessionId) as any[]

  const currentRound = allRounds.find((r: any) => !scoredNumbers.has(r.round_number))
  if (!currentRound) return res.status(400).json({ error: 'No unscored round available' })

  // Merge round_data into the round's data_json
  if (round_data) {
    const existingData = JSON.parse(currentRound.data_json || '{}')
    const mergedData = { ...existingData, ...round_data }
    db.prepare('UPDATE rounds SET data_json = ? WHERE id = ?').run(JSON.stringify(mergedData), currentRound.id)
  }

  const currentData = JSON.parse(currentRound.data_json || '{}')
  const roundMeta = {
    round_number: currentRound.round_number,
    hand_size: currentData.handSize ?? 0,
    data: { ...currentData, ...round_data },
  }

  // Hook rule: total bids must not equal available tricks
  if (game.slug === 'up-and-down') {
    const totalBids = rawScores.reduce((sum: number, s) => sum + (s.data?.bid ?? 0), 0)
    if (totalBids > 0 && totalBids === roundMeta.hand_size) {
      return res.status(400).json({
        error: `Hook rule: total bids (${totalBids}) cannot equal hand size (${roundMeta.hand_size})`,
      })
    }
  }

  const results = gameImpl.computeScore(roundMeta, rawScores)

  const insertScore = db.prepare(
    'INSERT INTO scores (round_id, player_id, score, data_json) VALUES (?, ?, ?, ?)'
  )

  const txn = db.transaction(() => {
    for (const r of results) {
      insertScore.run(currentRound.id, r.player_id, r.score, JSON.stringify(r.data))
    }
  })
  txn()

  // Check if game is complete
  if (currentRound.round_number >= totalRounds) {
    db.prepare('UPDATE game_sessions SET status = ? WHERE id = ?').run('completed', sessionId)
    return res.status(201).json({ scores: results, complete: true })
  }

  // Generate next round
  const nextRoundConfig = roundConfigs.find((rc) => rc.round_number === currentRound.round_number + 1)
  if (nextRoundConfig) {
    db.prepare(
      'INSERT INTO rounds (session_id, round_number, data_json) VALUES (?, ?, ?)'
    ).run(sessionId, nextRoundConfig.round_number, JSON.stringify(nextRoundConfig.data))
  }

  res.status(201).json({ scores: results, complete: false })
})

router.get('/:id/scoreboard', (req, res) => {
  const db = getDb()
  const sessionId = Number(req.params.id)

  const session = db.prepare('SELECT * FROM game_sessions WHERE id = ?').get(sessionId) as any
  if (!session) return res.status(404).json({ error: 'Session not found' })

  const config = JSON.parse(session.config_json || '{}')
  const totalRounds = config.total_rounds ?? 0
  const roundConfigs: { round_number: number }[] = config.round_configs ?? []
  const maxRounds = Math.max(totalRounds, roundConfigs.length)

  const players = db.prepare('SELECT * FROM players WHERE session_id = ? ORDER BY order_index').all(sessionId) as any[]
  const rounds = db.prepare('SELECT * FROM rounds WHERE session_id = ? ORDER BY round_number').all(sessionId) as any[]

  const roundsMeta = rounds.map((r: any) => ({
    round_number: r.round_number,
    data_json: r.data_json,
  }))

  const scoreboard = players.map((p: any) => {
    const scores: (number | null)[] = []
    for (let i = 1; i <= maxRounds; i++) {
      const round = rounds.find((r: any) => r.round_number === i)
      if (round) {
        const score = db.prepare(
          'SELECT score FROM scores WHERE round_id = ? AND player_id = ?'
        ).get(round.id, p.id) as { score: number } | undefined
        scores.push(score ? score.score : null)
      } else {
        scores.push(null)
      }
    }
    const total = scores.reduce((sum: number, s) => sum + (s ?? 0), 0)
    return {
      player_id: p.id,
      name: p.name,
      scores,
      total,
    }
  })

  res.json({ players: scoreboard, rounds_meta: roundsMeta })
})

export default router
