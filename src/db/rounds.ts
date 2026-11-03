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

  // A completed session has no editable round until undo reopens it.
  if (session.status === 'completed') {
    return { complete: true, round_number: 0, data_json: {}, fields: [] }
  }

  const game = await db.games.get(session.game_id)
  if (!game) throw new Error('Game not found')

  const gameImpl = getGame(game.slug)
  if (!gameImpl) throw new Error('Game implementation not found')

  // Find unscored rounds
  const allRounds = await db.rounds
    .where('session_id').equals(sessionId)
    .sortBy('round_number')

  const roundIds = allRounds
    .map((r) => r.id)
    .filter((id): id is number => id !== undefined)

  const sessionScores = roundIds.length
    ? await db.scores.where('round_id').anyOf(roundIds).toArray()
    : []
  const scoredRoundIds = new Set(sessionScores.map((s) => s.round_id))
  const currentRound = allRounds.find((r) => !scoredRoundIds.has(r.id!))

  if (!currentRound) {
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
  if (session.status !== 'active') throw new Error('Session is already complete')

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

  const roundIds = allRounds
    .map((r) => r.id)
    .filter((id): id is number => id !== undefined)

  const sessionScores = roundIds.length
    ? await db.scores.where('round_id').anyOf(roundIds).toArray()
    : []
  const scoredRoundIds = new Set(sessionScores.map((s) => s.round_id))
  const currentRound = allRounds.find((r) => !scoredRoundIds.has(r.id!))
  if (!currentRound) throw new Error('No unscored round available')

  const { round_data, scores: rawScores } = roundData

  const currentData = { ...currentRound.data_json, ...round_data }
  const roundMeta = {
    round_number: currentRound.round_number,
    hand_size: currentData.handSize ?? 0,
    data: currentData,
  }

  // Validate before writing anything so a rejected round leaves no trace.
  const invalid = gameImpl.validateRound?.(roundMeta, rawScores)
  if (invalid) throw new Error(invalid)

  // Merge round_data into the round's data_json
  if (round_data) {
    await db.rounds.update(currentRound.id!, { data_json: currentData })
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

  // Open-ended games never auto-complete; they always advance to the next
  // round and wait for the player to press "Finish game".
  if (gameImpl.roundMode === 'open') {
    await db.rounds.add({
      session_id: sessionId,
      round_number: currentRound.round_number + 1,
      data_json: {},
    })

    return { scores: results, complete: false }
  }

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

export async function undoLastRound(sessionId: number): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Session not found')

  const allRounds = await db.rounds
    .where('session_id').equals(sessionId)
    .sortBy('round_number')

  if (allRounds.length === 0) throw new Error('No rounds to undo')

  const roundIds = allRounds
    .map((r) => r.id)
    .filter((id): id is number => id !== undefined)

  const sessionScores = roundIds.length
    ? await db.scores.where('round_id').anyOf(roundIds).toArray()
    : []
  const roundsWithScores = allRounds.filter((r) =>
    sessionScores.some((s) => s.round_id === r.id)
  )

  if (roundsWithScores.length === 0) throw new Error('No scored rounds to undo')

  const lastRound = roundsWithScores[roundsWithScores.length - 1]

  await db.transaction('rw', db.scores, db.rounds, db.sessions, async () => {
    await db.scores.where('round_id').equals(lastRound.id!).delete()

    const nextRound = allRounds.find((r) => r.round_number === lastRound.round_number + 1)
    if (nextRound) {
      await db.rounds.delete(nextRound.id!)
    }

    if (session.status === 'completed') {
      await db.sessions.update(sessionId, { status: 'active' })
    }
  })
}

export async function getScoreboard(sessionId: number): Promise<ScoreboardResponse> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Session not found')

  const config = session.config_json ?? {}
  const totalRounds = config.total_rounds ?? 0
  const roundConfigs: { round_number: number }[] = config.round_configs ?? []

  const [players, rounds] = await Promise.all([
    db.players.where('session_id').equals(sessionId).sortBy('order_index'),
    db.rounds.where('session_id').equals(sessionId).sortBy('round_number'),
  ])

  // Open games have no pre-generated round count, so the played rounds
  // determine the width of each player's score array.
  const maxRounds = Math.max(totalRounds, roundConfigs.length, rounds.length)

  const roundsMeta: RoundMetaInfo[] = rounds.map((r) => ({
    round_number: r.round_number,
    data_json: r.data_json ?? {},
  }))

  const roundIds = rounds
    .map((r) => r.id)
    .filter((id): id is number => id !== undefined)

  // One query for every score in the session instead of one per player/round.
  const scores = roundIds.length
    ? await db.scores.where('round_id').anyOf(roundIds).toArray()
    : []

  const scoreByRoundAndPlayer = new Map<string, number>()
  for (const score of scores) {
    scoreByRoundAndPlayer.set(`${score.round_id}:${score.player_id}`, score.score)
  }

  const roundIdByNumber = new Map<number, number>()
  for (const round of rounds) {
    roundIdByNumber.set(round.round_number, round.id!)
  }

  const scoreboard: ScoreboardRow[] = players.map((player) => {
    const playerScores: (number | null)[] = []

    for (let roundNumber = 1; roundNumber <= maxRounds; roundNumber++) {
      const roundId = roundIdByNumber.get(roundNumber)
      const score =
        roundId === undefined
          ? undefined
          : scoreByRoundAndPlayer.get(`${roundId}:${player.id}`)
      playerScores.push(score ?? null)
    }

    const total = playerScores.reduce<number>((sum, s) => sum + (s ?? 0), 0)

    return {
      player_id: player.id!,
      name: player.name,
      scores: playerScores,
      total,
    }
  })

  return { players: scoreboard, rounds_meta: roundsMeta }
}
