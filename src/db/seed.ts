import type { CardzDB, Game } from './dexie-db'

const GAME_SEEDS: Omit<Game, 'id'>[] = [
  {
    slug: 'up-and-down',
    name: 'Up & Down The River',
    description: 'Trick-taking game where you bid the exact number of tricks you will win.',
    min_players: 3,
    max_players: 7,
    config_schema: [
      {
        key: 'peak',
        label: 'Peak hand size',
        type: 'number',
        defaultValue: 10,
        min: 1,
        max: 10,
        description: 'Maximum number of cards per hand at the peak round (capped by player count)',
      },
    ],
  },
  {
    slug: 'pay-me',
    name: 'Pay Me',
    description: 'Contract Rummy game. Lowest score after 11 rounds wins.',
    min_players: 2,
    max_players: 6,
    config_schema: [],
  },
  {
    slug: 'high-score',
    name: 'High Score',
    description:
      'Keep score for any game where the highest total wins. Enter points each round, then finish whenever you like.',
    min_players: 2,
    max_players: 10,
    config_schema: [],
  },
  {
    slug: 'low-score',
    name: 'Low Score',
    description:
      'Keep score for any game where the lowest total wins. Enter points each round, then finish whenever you like.',
    min_players: 2,
    max_players: 10,
    config_schema: [],
  },
]

export async function seedGames(db: CardzDB) {
  const existing = await db.games.toArray()
  const existingSlugs = new Set(existing.map((game) => game.slug))
  const missing = GAME_SEEDS.filter((game) => !existingSlugs.has(game.slug))

  if (missing.length > 0) {
    await db.games.bulkAdd(missing)
  }
}
