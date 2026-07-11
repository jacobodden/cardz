import { db } from './dexie-db'
import { getGame } from '../games'
import type { InputField } from '../games/types'

export interface ScoreboardRow {
  player_id: number
  name: string
  scores: (number | null)[]
  total: number
}

export interface RoundMetaInfo {
  round_number: number
  data_json: Record<string, any>
}

export interface ScoreboardResponse {
  players: ScoreboardRow[]
  rounds_meta: RoundMetaInfo[]
}

export interface CurrentRoundResult {
  round_number: number
  data_json: Record<string, any>
  fields: InputField[]
  complete?: boolean
}

export interface SubmitRoundResponse {
  scores: { player_id: number; score: number; data: Record<string, any> }[]
  complete: boolean
}

export async function getCurrentRound(sessionId: number): Promise<CurrentRoundResult> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Session not found')

  const game = await db.games.get(session.game_id)
  if (!game) throw new Error('Game not found')

  const gameImpl = getGame(game.slug)
  if (!gameImpl) throw new Error('Game implementation not found')

  const config = session.config_json ?? {}
  const totalRounds = config.total_rounds ?? 0

  // Find unscored rounds
  const allRounds = await db.rounds
    .where('session_id').equals(sessionId)
    .sortBy('round_number')

  // Get all round IDs that have scores
  const allScores = await db.scores.toArray()
  const scoredRoundIds = new Set(allScores.map((s) => s.round_id))
  const currentRound = allRounds.find((r) => !scoredRoundIds.has(r.id!))

  if (!currentRound) {
    if (allRounds.length >= totalRounds) {
      return { complete: true, round_number: 0, data_json: {}, fields: [] }
    }
    return { complete: true, round_number: 0, data_json: {}, fields: [] }
  }

  const data = currentRound.data_json ?? {}
  const fields = gameImpl.getRoundSchema({
    round_number: currentRound.round_number,
    hand_size: data.handSize ?? 0,
    data,
  })

  return {
    round_number: currentRound.round_number,
    data_json: data,
    fields,
  }
}

export async function submitRound(
  sessionId: number,
  roundData: { round_data?: Record<string, any>; scores: { player_id: number; data: Record<string, any> }[] }
): Promise<SubmitRoundResponse> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Session not found')

  const gameRecord = await db.games.get(session.game_id)
  if (!gameRecord) throw new Error('Game not found')

  const gameImpl = getGame(gameRecord.slug)
  if (!gameImpl) throw new Error('Game implementation not found')

  const config = session.config_json ?? {}
  const totalRounds = config.total_rounds ?? 0
  const roundConfigs: { round_number: number; hand_size: number; data: Record<string, any> }[] = config.round_configs ?? []

  // Find current unscored round
  const allRounds = await db.rounds
    .where('session_id').equals(sessionId)
    .sortBy('round_number')

  const allScores = await db.scores.toArray()
  const scoredRoundIds = new Set(allScores.map((s) => s.round_id))
  const currentRound = allRounds.find((r) => !scoredRoundIds.has(r.id!))
  if (!currentRound) throw new Error('No unscored round available')

  const { round_data, scores: rawScores } = roundData

  // Merge round_data into the round's data_json
  if (round_data) {
    const mergedData = { ...currentRound.data_json, ...round_data }
    await db.rounds.update(currentRound.id!, { data_json: mergedData })
  }

  const currentData = { ...currentRound.data_json, ...round_data }
  const roundMeta = {
    round_number: currentRound.round_number,
    hand_size: currentData.handSize ?? 0,
    data: currentData,
  }

  // Hook rule: total bids must not equal available tricks
  if (gameRecord.slug === 'up-and-down') {
    const totalBids = rawScores.reduce((sum: number, s) => sum + (s.data?.bid ?? 0), 0)
    if (totalBids > 0 && totalBids === roundMeta.hand_size) {
      throw new Error(`Hook rule: total bids (${totalBids}) cannot equal hand size (${roundMeta.hand_size})`)
    }
  }

  const results = gameImpl.computeScore(roundMeta, rawScores)

  // Insert scores in a transaction
  await db.transaction('rw', db.scores, async () => {
    for (const r of results) {
      await db.scores.add({
        round_id: currentRound.id!,
        player_id: r.player_id,
        score: r.score,
        data_json: r.data,
      })
    }
  })

  // Check if game is complete
  if (currentRound.round_number >= totalRounds) {
    await db.sessions.update(sessionId, { status: 'completed' })
    return { scores: results, complete: true }
  }

  // Generate next round
  const nextRoundConfig = roundConfigs.find(
    (rc) => rc.round_number === currentRound.round_number + 1
  )
  if (nextRoundConfig) {
    await db.rounds.add({
      session_id: sessionId,
      round_number: nextRoundConfig.round_number,
      data_json: nextRoundConfig.data,
    })
  }

  return { scores: results, complete: false }
}

export async function getScoreboard(sessionId: number): Promise<ScoreboardResponse> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Session not found')

  const config = session.config_json ?? {}
  const totalRounds = config.total_rounds ?? 0
  const roundConfigs: { round_number: number }[] = config.round_configs ?? []
  const maxRounds = Math.max(totalRounds, roundConfigs.length)

  const [players, rounds] = await Promise.all([
    db.players.where('session_id').equals(sessionId).sortBy('order_index'),
    db.rounds.where('session_id').equals(sessionId).sortBy('round_number'),
  ])

  const roundsMeta: RoundMetaInfo[] = rounds.map((r) => ({
    round_number: r.round_number,
    data_json: r.data_json ?? {},
  }))

  // Build per-player per-round score arrays
  const scoreboard: ScoreboardRow[] = await Promise.all(
    players.map(async (p) => {
      const scores: (number | null)[] = []

      for (let i = 1; i <= maxRounds; i++) {
        const round = rounds.find((r) => r.round_number === i)
        if (round) {
          const scoreRecord = await db.scores
            .where({ round_id: round.id!, player_id: p.id! })
            .first()
          scores.push(scoreRecord ? scoreRecord.score : null)
        } else {
          scores.push(null)
        }
      }

      const total = scores.reduce<number>((sum, s) => sum + (s ?? 0), 0)

      return {
        player_id: p.id!,
        name: p.name,
        scores,
        total,
      }
    })
  )

  return { players: scoreboard, rounds_meta: roundsMeta }
}
