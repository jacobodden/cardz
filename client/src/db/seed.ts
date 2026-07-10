import type { CardzDB } from './dexie-db'

export async function seedGames(db: CardzDB) {
  const count = await db.games.count()
  if (count > 0) return

  await db.games.bulkAdd([
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
  ])
}
