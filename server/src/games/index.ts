import type { CardGame } from './types.js'
import { upAndDown } from './upanddown.js'
import { payMe } from './payme.js'

const registry: Record<string, CardGame> = {
  'up-and-down': upAndDown,
  'pay-me': payMe,
}

export function getGame(slug: string): CardGame | undefined {
  return registry[slug]
}

export function getAllGames(): CardGame[] {
  return Object.values(registry)
}
