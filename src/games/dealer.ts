import type { CardGame, RoundInfoChip, RoundMeta } from './types'

/**
 * The dealer is stored on each round as `data.dealer_player_id`. Fixed games
 * set it for every round up front; open games pass it to the next seat after
 * each round, and players can move it at will. The Session page marks the
 * dealer with a D in every dealer game.
 */

/**
 * Whether players can move the dealer: only open games, where the deal is
 * passed on round by round. Fixed games set every round's dealer up front.
 */
export function canMoveDealer(game: CardGame | undefined): boolean {
  return !!game?.usesDealer && game.roundMode === 'open'
}

/**
 * The player after `currentId` in seat order (`order_index`), wrapping
 * around. Undefined when there's no current dealer or they aren't seated.
 */
export function nextDealerId(
  players: readonly { id: number; order_index: number }[],
  currentId: number | undefined
): number | undefined {
  if (currentId === undefined) return undefined
  const seats = [...players].sort((a, b) => a.order_index - b.order_index)
  const at = seats.findIndex((p) => p.id === currentId)
  if (at === -1) return undefined
  return seats[(at + 1) % seats.length].id
}

/** The "Dealer <name>" chip for a round, if it has a dealer who's seated. */
export function dealerChip(meta: RoundMeta, players: readonly { id: number; name: string }[]): RoundInfoChip | null {
  const dealer = players.find((p) => p.id === meta.data.dealer_player_id)
  return dealer ? { key: 'dealer', label: 'Dealer', value: dealer.name } : null
}
