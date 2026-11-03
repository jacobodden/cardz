import type { CardFace, CardGame } from './types'

function makePointsGame(
  slug: string,
  name: string,
  scoreDirection: 'high' | 'low',
  cardFace: CardFace
): CardGame {
  return {
    slug,
    name,
    description: `Keep score for any game where the ${scoreDirection === 'high' ? 'highest' : 'lowest'} total wins. Enter points each round, then finish whenever you like.`,
    minPlayers: 2,
    maxPlayers: 10,
    scoreDirection,
    cardFace,
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

export const highScore = makePointsGame('high-score', 'High Score', 'high', { rank: 'A', suit: '♦' })
export const lowScore = makePointsGame('low-score', 'Low Score', 'low', { rank: '2', suit: '♣' })
