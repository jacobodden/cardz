import type { CardzDB, Game } from './dexie-db'
import { getAllGames } from '../games'
import type { CardGame } from '../games/types'

/** The `games` row for a game module. The module is the source of truth. */
export function gameRow(game: CardGame): Omit<Game, 'id'> {
  return {
    slug: game.slug,
    name: game.name,
    description: game.description,
    min_players: game.minPlayers,
    max_players: game.maxPlayers,
    config_schema: game.getConfigSchema(),
  }
}

function sameRow(a: Omit<Game, 'id'>, b: Omit<Game, 'id'>): boolean {
  return (
    a.name === b.name &&
    a.description === b.description &&
    a.min_players === b.min_players &&
    a.max_players === b.max_players &&
    JSON.stringify(a.config_schema) === JSON.stringify(b.config_schema)
  )
}

/**
 * Upsert every registered game by slug. New games are added and changed
 * definitions update the existing row in place (keeping its id, so sessions
 * still point at it). Rows for games no longer in code are left alone so old
 * sessions keep their game name.
 */
export async function seedGames(db: CardzDB) {
  await db.transaction('rw', db.games, async () => {
    const existing = new Map((await db.games.toArray()).map((g) => [g.slug, g]))

    for (const game of getAllGames()) {
      const row = gameRow(game)
      const current = existing.get(game.slug)
      if (!current) {
        await db.games.add(row)
      } else if (!sameRow(current, row)) {
        await db.games.update(current.id!, row)
      }
    }
  })
}
