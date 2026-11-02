import type { CardGame } from './types'
import { upAndDown } from './upanddown'
import { payMe } from './payme'
import { highScore, lowScore } from './points'

const registry: Record<string, CardGame> = {
  'up-and-down': upAndDown,
  'pay-me': payMe,
  'high-score': highScore,
  'low-score': lowScore,
}

export function getGame(slug: string): CardGame | undefined {
  return registry[slug]
}

export function getAllGames(): CardGame[] {
  return Object.values(registry)
}
