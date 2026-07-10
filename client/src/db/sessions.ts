import { db } from './dexie-db'
import { getGame } from '../games'
import type { Game } from './dexie-db'

export interface SessionSummary {
  id: number
  game_id: number
  title: string | null
  status: string
  created_at: string
  game_name: string | null
  game_slug: string | null
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
  const sessions = await db.sessions.orderBy('created_at').reverse().toArray()
  const games = await db.games.toArray()
  const gameMap = new Map<number, Game>(games.map((g) => [g.id!, g]))

  return sessions.map((s) => ({
    id: s.id!,
    game_id: s.game_id,
    title: s.title,
    status: s.status,
    created_at: s.created_at,
    game_name: gameMap.get(s.game_id)?.name ?? null,
    game_slug: gameMap.get(s.game_id)?.slug ?? null,
  }))
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

  const allRounds = gameImpl.getRounds(players.length, config)

  const firstDealerIndex = config?.first_dealer_index ?? 0
  const roundConfigs = allRounds.map((r, i) => {
    const dealerIdx = (firstDealerIndex + i) % players.length
    return {
      round_number: r.round_number,
      hand_size: r.hand_size,
      data: { ...r.data, dealer_player_id: players[dealerIdx].id! },
    }
  })


  const mergedConfig = { ...config, total_rounds: allRounds.length, round_configs: roundConfigs }

  await db.sessions.update(sessionId, { config_json: mergedConfig })

  // Create first round
  await db.rounds.add({
    session_id: sessionId,
    round_number: 1,
    data_json: roundConfigs[0].data,
  })
}
