import { db, dbReady } from '../../src/db/dexie-db'
import { seedGames } from '../../src/db/seed'
import { createSession, addPlayer, startSession } from '../../src/db/sessions'

/** Empty every table and re-seed the game definitions. */
export async function resetDb() {
  await dbReady
  await Promise.all(db.tables.map((t) => t.clear()))
  await seedGames(db)
}

export async function gameId(slug: string): Promise<number> {
  const game = await db.games.where('slug').equals(slug).first()
  if (!game?.id) throw new Error(`Game ${slug} not seeded`)
  return game.id
}

/** Create and start a session; returns the session id and player ids in seat order. */
export async function startGame(
  slug: string,
  names: string[],
  config?: Record<string, any>,
) {
  const session = await createSession(await gameId(slug), 'Test game')
  const playerIds: number[] = []
  for (const name of names) {
    playerIds.push((await addPlayer(session.id, name)).id)
  }
  await startSession(session.id, config)
  return { sessionId: session.id, playerIds }
}
