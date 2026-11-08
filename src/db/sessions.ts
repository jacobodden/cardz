import { db } from './dexie-db'
import { getGame } from '../games'
import { topByTotal } from '../games/standings'
import type { Game } from './dexie-db'

export interface SessionStanding {
  /** Names of the player(s) with the best total; more than one on a tie. */
  names: string[]
  total: number
}

export interface SessionSummary {
  id: number
  game_id: number
  title: string | null
  status: string
  created_at: string
  game_name: string | null
  game_slug: string | null
  /** Player names in seat order. */
  players: string[]
  /** Leader (active) or winner (completed); null until a round is scored. */
  standing: SessionStanding | null
  /** Rounds with scores entered. */
  rounds_scored: number
  /** Planned rounds for fixed games; null for open-ended ones. */
  total_rounds: number | null
}

export interface SessionDetail {
  id: number
  game_id: number
  title: string | null
  status: string
  config_json: Record<string, any>
  created_at: string
  game: Game | null
  players: { id: number; name: string; order_index: number }[]
  total_rounds: number | null
}

export interface PlayerResult {
  id: number
  session_id: number
  name: string
  order_index: number
}

function now(): string {
  return new Date().toISOString()
}

export async function listSessions(): Promise<SessionSummary[]> {
  // The home list shows every session, so read each table once instead of
  // querying per session.
  const [sessions, games, players, scores] = await Promise.all([
    db.sessions.orderBy('created_at').reverse().toArray(),
    db.games.toArray(),
    db.players.orderBy('order_index').toArray(),
    db.scores.toArray(),
  ])
  const gameMap = new Map<number, Game>(games.map((g) => [g.id!, g]))

  const totals = new Map<number, number>()
  const scoreCounts = new Map<number, number>()
  for (const score of scores) {
    totals.set(score.player_id, (totals.get(score.player_id) ?? 0) + score.score)
    scoreCounts.set(score.player_id, (scoreCounts.get(score.player_id) ?? 0) + 1)
  }

  const playersBySession = new Map<number, typeof players>()
  for (const player of players) {
    const list = playersBySession.get(player.session_id) ?? []
    list.push(player)
    playersBySession.set(player.session_id, list)
  }

  return sessions.map((s) => {
    const game = gameMap.get(s.game_id)
    const seated = playersBySession.get(s.id!) ?? []
    const direction = (game && getGame(game.slug)?.scoreDirection) ?? 'high'

    const rows = seated
      .filter((p) => totals.has(p.id!))
      .map((p) => ({ name: p.name, total: totals.get(p.id!)! }))
    const top = topByTotal(rows, direction)
    // Each scored round gives every seated player one score.
    const roundsScored = Math.max(0, ...seated.map((p) => scoreCounts.get(p.id!) ?? 0))
    const totalRounds = s.config_json?.total_rounds

    return {
      id: s.id!,
      game_id: s.game_id,
      title: s.title,
      status: s.status,
      created_at: s.created_at,
      game_name: game?.name ?? null,
      game_slug: game?.slug ?? null,
      players: seated.map((p) => p.name),
      standing: top.length > 0 ? { names: top.map((r) => r.name), total: top[0].total } : null,
      rounds_scored: roundsScored,
      total_rounds: typeof totalRounds === 'number' && totalRounds > 0 ? totalRounds : null,
    }
  })
}

export async function getSession(id: number): Promise<SessionDetail> {
  const session = await db.sessions.get(id)
  if (!session) throw new Error('Session not found')

  const [game, players] = await Promise.all([
    db.games.get(session.game_id),
    db.players.where('session_id').equals(id).sortBy('order_index'),
  ])

  const config = session.config_json ?? {}
  return {
    id: session.id!,
    game_id: session.game_id,
    title: session.title,
    status: session.status,
    config_json: config,
    created_at: session.created_at,
    game: game ?? null,
    players: players.map((p) => ({
      id: p.id!,
      name: p.name,
      order_index: p.order_index,
    })),
    total_rounds: config.total_rounds ?? null,
  }
}

export async function createSession(game_id: number, title?: string) {
  const id = await db.sessions.add({
    game_id,
    title: title ?? null,
    status: 'active',
    config_json: {},
    created_at: now(),
  })

  const session = await db.sessions.get(id)
  if (!session) throw new Error('Failed to create session')
  return { id: session.id!, game_id: session.game_id, title: session.title, status: session.status, created_at: session.created_at }
}

export async function addPlayer(sessionId: number, name: string): Promise<PlayerResult> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Session not found')
  if (session.status !== 'active') throw new Error('Session is not active')

  const existing = await db.players.where('session_id').equals(sessionId).toArray()
  const maxOrder = existing.reduce((max, p) => Math.max(max, p.order_index), 0)

  const id = await db.players.add({
    session_id: sessionId,
    name,
    order_index: maxOrder + 1,
  })

  const player = await db.players.get(id)
  if (!player) throw new Error('Failed to add player')
  return { id: player.id!, session_id: player.session_id, name: player.name, order_index: player.order_index }
}

export async function removePlayer(_sessionId: number, playerId: number): Promise<void> {
  await db.players.delete(playerId)
}

export async function deleteSession(id: number): Promise<void> {
  const rounds = await db.rounds.where('session_id').equals(id).toArray()
  const roundIds = rounds.map((r) => r.id!).filter(Boolean)

  await db.transaction('rw', db.sessions, db.players, db.rounds, db.scores, async () => {
    if (roundIds.length > 0) {
      await db.scores.where('round_id').anyOf(roundIds).delete()
    }
    await db.rounds.where('session_id').equals(id).delete()
    await db.players.where('session_id').equals(id).delete()
    await db.sessions.delete(id)
  })
}

export async function startSession(sessionId: number, config?: Record<string, any>): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Session not found')
  if (session.status !== 'active') throw new Error('Session already started')

  const game = await db.games.get(session.game_id)
  if (!game) throw new Error('Game not found')

  const gameImpl = getGame(game.slug)
  if (!gameImpl) throw new Error('Game implementation not found')

  const players = await db.players.where('session_id').equals(sessionId).sortBy('order_index')
  if (players.length === 0) throw new Error('Need at least one player')

  const usesDealer = gameImpl.usesDealer ?? false
  const firstDealerIndex = config?.first_dealer_index ?? 0

  if (gameImpl.roundMode === 'open') {
    await db.sessions.update(sessionId, {
      config_json: { ...config, total_rounds: 0, round_configs: [] },
    })

    // Later rounds get their dealer as each round is submitted.
    await db.rounds.add({
      session_id: sessionId,
      round_number: 1,
      data_json: usesDealer
        ? { dealer_player_id: players[firstDealerIndex % players.length].id! }
        : {},
    })
    return
  }

  const allRounds = gameImpl.getRounds(players.length, config)

  const roundConfigs = allRounds.map((round, index) => ({
    round_number: round.round_number,
    hand_size: round.hand_size,
    data: usesDealer
      ? {
          ...round.data,
          dealer_player_id:
            players[(firstDealerIndex + index) % players.length].id!,
        }
      : { ...round.data },
  }))

  const mergedConfig = { ...config, total_rounds: allRounds.length, round_configs: roundConfigs }

  await db.sessions.update(sessionId, { config_json: mergedConfig })

  // Create first round
  await db.rounds.add({
    session_id: sessionId,
    round_number: 1,
    data_json: roundConfigs[0].data,
  })
}

export async function finishSession(sessionId: number): Promise<void> {
  const session = await db.sessions.get(sessionId)
  if (!session) throw new Error('Session not found')
  if (session.status !== 'active') throw new Error('Session is not active')

  const rounds = await db.rounds
    .where('session_id').equals(sessionId)
    .sortBy('round_number')

  const roundIds = rounds
    .map((round) => round.id)
    .filter((id): id is number => id !== undefined)

  const scores = roundIds.length
    ? await db.scores.where('round_id').anyOf(roundIds).toArray()
    : []

  const scoredRoundIds = new Set(scores.map((score) => score.round_id))
  if (scoredRoundIds.size === 0) {
    throw new Error('Score at least one round before finishing')
  }

  // Remove the trailing unscored round so the final scoreboard only shows
  // rounds that were actually played.
  const unscoredRounds = rounds.filter(
    (round) => !scoredRoundIds.has(round.id!)
  )

  await db.transaction('rw', db.rounds, db.sessions, async () => {
    for (const round of unscoredRounds) {
      await db.rounds.delete(round.id!)
    }
    await db.sessions.update(sessionId, { status: 'completed' })
  })
}
