import type { CardGame } from './types'
import { upAndDown } from './upanddown'
import { payMe } from './payme'

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
