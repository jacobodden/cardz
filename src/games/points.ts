import type { CardGame } from './types'

function makePointsGame(
  slug: string,
  scoreDirection: 'high' | 'low'
): CardGame {
  return {
    slug,
    scoreDirection,
    roundMode: 'open',
    usesDealer: false,

    getConfigSchema: () => [],

    // Open games create rounds as they are played, so there is no
    // pre-generated round list.
    getRounds: () => [],

    getRoundSchema: () => [
      {
        key: 'points',
        label: 'Points',
        type: 'number',
        scope: 'player',
      },
    ],

    computeScore: (_meta, inputs) =>
      inputs.map((input) => {
        const raw = input.data.points
        const parsed = typeof raw === 'number' ? raw : Number(raw ?? 0)
        const points = Number.isFinite(parsed) ? parsed : 0

        return {
          player_id: input.player_id,
          score: points,
          data: { points },
        }
      }),
  }
}

export const highScore = makePointsGame('high-score', 'high')
export const lowScore = makePointsGame('low-score', 'low')
