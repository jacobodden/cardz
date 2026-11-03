import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../../src/db/dexie-db'
import { gameRow, seedGames } from '../../src/db/seed'
import { getAllGames } from '../../src/games'
import { upAndDown } from '../../src/games/upanddown'
import {
  addPlayer,
  createSession,
  deleteSession,
  finishSession,
  getSession,
  listSessions,
  startSession,
} from '../../src/db/sessions'
import { getCurrentRound, getScoreboard, submitRound, undoLastRound } from '../../src/db/rounds'
import { gameId, resetDb, startGame } from './db-helpers'

beforeEach(resetDb)

/** Up & Down round where everyone bids `bid`, with the given success flags. */
function udRound(playerIds: number[], bids: number[], made: boolean[], trump = '♠') {
  return {
    round_data: { trump },
    scores: playerIds.map((player_id, i) => ({ player_id, data: { bid: bids[i], success: made[i] } })),
  }
}

const pointsRound = (playerIds: number[], points: number[]) => ({
  scores: playerIds.map((player_id, i) => ({ player_id, data: { points: points[i] } })),
})

const payMeRound = (playerIds: number[], values: number[]) => ({
  scores: playerIds.map((player_id, i) => ({ player_id, data: { cardValue: values[i] } })),
})

describe('seedGames', () => {
  it('seeds all four games', async () => {
    expect((await db.games.toArray()).map((g) => g.slug).sort()).toEqual(
      ['high-score', 'low-score', 'pay-me', 'up-and-down'],
    )
  })

  it('is idempotent and only adds missing games', async () => {
    await db.games.where('slug').equals('pay-me').delete()
    await seedGames(db)
    await seedGames(db)
    expect(await db.games.count()).toBe(4)
    expect(await db.games.where('slug').equals('pay-me').count()).toBe(1)
  })

  it('derives every row from the game modules', async () => {
    for (const game of getAllGames()) {
      const row = await db.games.where('slug').equals(game.slug).first()
      expect(row).toMatchObject(gameRow(game))
    }
  })

  it('updates stale definitions in place, keeping the id', async () => {
    const before = await db.games.where('slug').equals('up-and-down').first()
    await db.games.update(before!.id!, {
      name: 'Old name',
      max_players: 5,
      config_schema: [],
    })

    await seedGames(db)

    const after = await db.games.where('slug').equals('up-and-down').first()
    expect(after?.id).toBe(before!.id)
    expect(after).toMatchObject(gameRow(upAndDown))
    expect(await db.games.count()).toBe(4)
  })

  it('leaves rows for games no longer in code alone', async () => {
    await db.games.add({
      slug: 'retired',
      name: 'Retired',
      description: '',
      min_players: 2,
      max_players: 4,
      config_schema: [],
    })
    await seedGames(db)
    expect(await db.games.where('slug').equals('retired').count()).toBe(1)
  })
})

describe('sessions', () => {
  it('creates an active session and adds players in order', async () => {
    const s = await createSession(await gameId('pay-me'), 'Friday')
    const a = await addPlayer(s.id, 'Ann')
    const b = await addPlayer(s.id, 'Bob')
    expect(s.status).toBe('active')
    expect(b.order_index).toBeGreaterThan(a.order_index)

    const detail = await getSession(s.id)
    expect(detail.title).toBe('Friday')
    expect(detail.game?.slug).toBe('pay-me')
    expect(detail.players.map((p) => p.name)).toEqual(['Ann', 'Bob'])
  })

  it('lists sessions newest first with game names', async () => {
    const first = await createSession(await gameId('pay-me'))
    await new Promise((r) => setTimeout(r, 5))
    const second = await createSession(await gameId('high-score'), 'Later')
    const list = await listSessions()
    expect(list.map((s) => s.id)).toEqual([second.id, first.id])
    expect(list[0]).toMatchObject({ title: 'Later', game_name: 'High Score', game_slug: 'high-score' })
  })

  it('lists players in seat order and the current leader', async () => {
    const { sessionId, playerIds } = await startGame('high-score', ['Ann', 'Bob', 'Cat'])
    let [summary] = await listSessions()
    expect(summary.id).toBe(sessionId)
    expect(summary.players).toEqual(['Ann', 'Bob', 'Cat'])
    expect(summary.standing).toBeNull()

    await submitRound(sessionId, pointsRound(playerIds, [3, 9, -2]))
    ;[summary] = await listSessions()
    expect(summary.standing).toEqual({ names: ['Bob'], total: 9 })
  })

  it('picks the lowest total for low-score games and reports ties', async () => {
    const { sessionId, playerIds } = await startGame('low-score', ['Ann', 'Bob', 'Cat'])
    await submitRound(sessionId, pointsRound(playerIds, [4, 2, 2]))
    await finishSession(sessionId)
    const [summary] = await listSessions()
    expect(summary.status).toBe('completed')
    expect(summary.standing).toEqual({ names: ['Bob', 'Cat'], total: 2 })
  })

  it('keeps standings separate per session', async () => {
    const a = await startGame('high-score', ['Ann', 'Bob'])
    const b = await startGame('high-score', ['Cat', 'Dan'])
    await submitRound(a.sessionId, pointsRound(a.playerIds, [1, 5]))
    await submitRound(b.sessionId, pointsRound(b.playerIds, [7, 2]))
    const byId = new Map((await listSessions()).map((s) => [s.id, s]))
    expect(byId.get(a.sessionId)?.standing).toEqual({ names: ['Bob'], total: 5 })
    expect(byId.get(b.sessionId)?.standing).toEqual({ names: ['Cat'], total: 7 })
  })

  it('refuses to start without players', async () => {
    const s = await createSession(await gameId('pay-me'))
    await expect(startSession(s.id)).rejects.toThrow('Need at least one player')
  })

  it('stores the round plan and creates round 1 for fixed games', async () => {
    const { sessionId } = await startGame('pay-me', ['A', 'B'])
    const session = await db.sessions.get(sessionId)
    expect(session?.config_json.total_rounds).toBe(11)
    expect(session?.config_json.round_configs).toHaveLength(11)
    expect(await db.rounds.where('session_id').equals(sessionId).count()).toBe(1)
  })

  it('rotates the Up & Down dealer from the chosen first dealer', async () => {
    const { sessionId, playerIds } = await startGame('up-and-down', ['A', 'B', 'C'], {
      peak: 3,
      first_dealer_index: 1,
    })
    const configs = (await db.sessions.get(sessionId))!.config_json.round_configs
    expect(configs.map((c: any) => c.data.dealer_player_id)).toEqual([
      playerIds[1], playerIds[2], playerIds[0], playerIds[1], playerIds[2],
    ])
  })

  it('starts open games with no round plan', async () => {
    const { sessionId } = await startGame('high-score', ['A', 'B'])
    const session = await db.sessions.get(sessionId)
    expect(session?.config_json).toMatchObject({ total_rounds: 0, round_configs: [] })
    expect((await getCurrentRound(sessionId)).round_number).toBe(1)
  })

  it('deletes a session with all its players, rounds and scores', async () => {
    const { sessionId, playerIds } = await startGame('high-score', ['A', 'B'])
    await submitRound(sessionId, pointsRound(playerIds, [1, 2]))
    const other = await startGame('low-score', ['C', 'D'])

    await deleteSession(sessionId)

    expect(await db.sessions.get(sessionId)).toBeUndefined()
    expect(await db.players.where('session_id').equals(sessionId).count()).toBe(0)
    expect(await db.rounds.where('session_id').equals(sessionId).count()).toBe(0)
    expect(await db.scores.count()).toBe(0)
    // The other session is untouched
    expect(await db.players.where('session_id').equals(other.sessionId).count()).toBe(2)
  })
})

describe('submitRound', () => {
  it('scores a round, saves round data and advances', async () => {
    const { sessionId, playerIds } = await startGame('up-and-down', ['A', 'B', 'C'], { peak: 3 })
    const res = await submitRound(sessionId, udRound(playerIds, [1, 1, 0], [true, false, true], '♥'))

    expect(res.complete).toBe(false)
    expect(res.scores.map((s) => s.score)).toEqual([11, 0, 10])

    const round1 = await db.rounds.where({ session_id: sessionId, round_number: 1 }).first()
    expect(round1?.data_json.trump).toBe('♥')

    const current = await getCurrentRound(sessionId)
    expect(current.round_number).toBe(2)
    expect(current.data_json.handSize).toBe(2)
  })

  it('enforces the Up & Down hook rule', async () => {
    const { sessionId, playerIds } = await startGame('up-and-down', ['A', 'B', 'C'], { peak: 3 })
    await submitRound(sessionId, udRound(playerIds, [0, 0, 0], [true, true, false])) // round 1, hand 1
    // Round 2 has 2 cards: bids totalling 2 are not allowed
    await expect(
      submitRound(sessionId, udRound(playerIds, [1, 1, 0], [true, false, false])),
    ).rejects.toThrow(/Hook rule/)
    expect(await db.scores.count()).toBe(3)
  })

  it('does not save round data for a rejected round', async () => {
    const { sessionId, playerIds } = await startGame('up-and-down', ['A', 'B', 'C'], { peak: 3 })
    await expect(
      submitRound(sessionId, udRound(playerIds, [1, 0, 0], [true, false, false], '♦')),
    ).rejects.toThrow(/Hook rule/)
    const round1 = await db.rounds.where({ session_id: sessionId, round_number: 1 }).first()
    expect(round1?.data_json.trump).toBeUndefined()
  })

  it('requires at least one Up & Down player to fail', async () => {
    const { sessionId, playerIds } = await startGame('up-and-down', ['A', 'B', 'C'], { peak: 3 })
    await expect(
      submitRound(sessionId, udRound(playerIds, [0, 0, 0], [true, true, true])),
    ).rejects.toThrow(/At least one must fail/)
  })

  it('completes a fixed game after the last round', async () => {
    const { sessionId, playerIds } = await startGame('pay-me', ['A', 'B'])
    for (let i = 0; i < 10; i++) {
      expect((await submitRound(sessionId, payMeRound(playerIds, [i, 0]))).complete).toBe(false)
    }
    const last = await submitRound(sessionId, payMeRound(playerIds, [5, 5]))
    expect(last.complete).toBe(true)
    expect((await db.sessions.get(sessionId))?.status).toBe('completed')
    expect((await getCurrentRound(sessionId)).complete).toBe(true)
    await expect(submitRound(sessionId, payMeRound(playerIds, [1, 1]))).rejects.toThrow(/already complete/)
  })

  it('keeps open games going round after round', async () => {
    const { sessionId, playerIds } = await startGame('low-score', ['A', 'B'])
    for (let i = 0; i < 3; i++) {
      expect((await submitRound(sessionId, pointsRound(playerIds, [1, 2]))).complete).toBe(false)
    }
    expect((await getCurrentRound(sessionId)).round_number).toBe(4)
  })
})

describe('undoLastRound', () => {
  it('removes the last scored round and the round after it', async () => {
    const { sessionId, playerIds } = await startGame('high-score', ['A', 'B'])
    await submitRound(sessionId, pointsRound(playerIds, [1, 2]))
    await submitRound(sessionId, pointsRound(playerIds, [3, 4]))

    await undoLastRound(sessionId)

    expect((await getCurrentRound(sessionId)).round_number).toBe(2)
    expect(await db.rounds.where('session_id').equals(sessionId).count()).toBe(2)
    expect((await getScoreboard(sessionId)).players.map((p) => p.total)).toEqual([1, 2])
  })

  it('reopens a completed fixed game', async () => {
    const { sessionId, playerIds } = await startGame('up-and-down', ['A', 'B', 'C'], { peak: 1 })
    const res = await submitRound(sessionId, udRound(playerIds, [0, 0, 0], [true, true, false]))
    expect(res.complete).toBe(true)

    await undoLastRound(sessionId)

    expect((await db.sessions.get(sessionId))?.status).toBe('active')
    expect((await getCurrentRound(sessionId)).round_number).toBe(1)
  })

  it('errors when nothing has been scored', async () => {
    const { sessionId } = await startGame('high-score', ['A', 'B'])
    await expect(undoLastRound(sessionId)).rejects.toThrow('No scored rounds to undo')
  })
})

describe('finishSession', () => {
  it('requires at least one scored round', async () => {
    const { sessionId } = await startGame('high-score', ['A', 'B'])
    await expect(finishSession(sessionId)).rejects.toThrow(/at least one round/)
  })

  it('completes an open game and drops the trailing unscored round', async () => {
    const { sessionId, playerIds } = await startGame('high-score', ['A', 'B'])
    await submitRound(sessionId, pointsRound(playerIds, [5, 3]))
    await submitRound(sessionId, pointsRound(playerIds, [2, 9]))

    await finishSession(sessionId)

    expect((await db.sessions.get(sessionId))?.status).toBe('completed')
    const board = await getScoreboard(sessionId)
    expect(board.rounds_meta).toHaveLength(2)
    expect(board.players.map((p) => p.scores)).toEqual([[5, 2], [3, 9]])
    await expect(finishSession(sessionId)).rejects.toThrow(/not active/)
  })

  it('can be undone, reopening the last round', async () => {
    const { sessionId, playerIds } = await startGame('high-score', ['A', 'B'])
    await submitRound(sessionId, pointsRound(playerIds, [5, 3]))
    await finishSession(sessionId)

    await undoLastRound(sessionId)

    expect((await db.sessions.get(sessionId))?.status).toBe('active')
    expect((await getCurrentRound(sessionId)).round_number).toBe(1)
    expect(await db.scores.count()).toBe(0)
  })
})

describe('getScoreboard', () => {
  it('pads unplayed fixed rounds with null and totals played ones', async () => {
    const { sessionId, playerIds } = await startGame('pay-me', ['A', 'B'])
    await submitRound(sessionId, payMeRound(playerIds, [10, 0]))
    await submitRound(sessionId, payMeRound(playerIds, [4, 6]))

    const board = await getScoreboard(sessionId)
    expect(board.players[0].name).toBe('A')
    expect(board.players[0].scores).toHaveLength(11)
    expect(board.players[0].scores.slice(0, 3)).toEqual([10, 4, null])
    expect(board.players.map((p) => p.total)).toEqual([14, 6])
  })
})
