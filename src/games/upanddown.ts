import type { CardGame, RoundMeta, InputField, PlayerScoreInput, PlayerScoreResult, ConfigField, RoundInfoChip } from './types'
import { dealerChip } from './dealer'

const SUITS = ['♠', '♥', '♣', '♦']
const RED_SUITS = new Set(['♥', '♦'])
const MAX_PEAK = 10

/** Largest hand every player can be dealt from one deck (one card turned for trump). */
function maxHandSize(playerCount: number): number {
  return Math.floor(51 / playerCount)
}

/**
 * Whether `tricks` can be shared among players who missed their bids so
 * each one wins a number of tricks different from their bid.
 */
export function canSplitMissedTricks(tricks: number, missedBids: number[]): boolean {
  // reachable[n]: the players so far can have won n tricks in total.
  let reachable = new Set([0])
  for (const bid of missedBids) {
    const next = new Set<number>()
    for (const sum of reachable) {
      for (let won = 0; sum + won <= tricks; won++) {
        if (won !== bid) next.add(sum + won)
      }
    }
    reachable = next
  }
  return reachable.has(tricks)
}

export const upAndDown: CardGame = {
  slug: 'up-and-down',
  name: 'Up & Down The River',
  description: 'Trick-taking game where you bid the exact number of tricks you will win.',
  minPlayers: 3,
  maxPlayers: 7,
  scoreDirection: 'high',
  cardFace: { rank: 'K', suit: '♠' },
  roundMode: 'fixed',
  usesDealer: true,

  getRounds(playerCount: number, config?: Record<string, any>): RoundMeta[] {
    const defaultPeak = maxHandSize(playerCount)
    const peak = Math.min(config?.peak ?? defaultPeak, defaultPeak)
    const totalRounds = peak * 2 - 1
    const rounds: RoundMeta[] = []

    for (let i = 0; i < totalRounds; i++) {
      const handSize = i < peak ? i + 1 : peak * 2 - (i + 1)
      rounds.push({
        round_number: i + 1,
        hand_size: handSize,
        data: { handSize },
      })
    }
    return rounds
  },

  getConfigSchema(): ConfigField[] {
    return [
      {
        key: 'peak',
        label: 'Peak hand size',
        type: 'number',
        defaultValue: MAX_PEAK,
        min: 1,
        max: MAX_PEAK,
        description: 'Maximum number of cards per hand at the peak round (capped by player count)',
      },
    ]
  },

  getDefaultConfig(playerCount: number) {
    if (playerCount < 1) return { peak: MAX_PEAK }
    return { peak: Math.min(maxHandSize(playerCount), MAX_PEAK) }
  },

  validateRound(meta: RoundMeta, inputs: PlayerScoreInput[]): string | null {
    // Hook rule: the dealer must bid so that total bids != available tricks.
    const totalBids = inputs.reduce((sum, i) => sum + (Number(i.data?.bid) || 0), 0)
    if (meta.hand_size > 0 && totalBids === meta.hand_size) {
      return `Hook rule: total bids (${totalBids}) cannot equal hand size (${meta.hand_size})`
    }

    if (inputs.length > 0 && inputs.every((i) => i.data?.success === true)) {
      return 'Not every player can succeed. At least one must fail this round.'
    }

    // A player who made their bid won exactly that many tricks, and the round
    // only has hand_size tricks, so the made bids can't add up to more.
    const madeTricks = inputs
      .filter((i) => i.data?.success === true)
      .reduce((sum, i) => sum + (Number(i.data?.bid) || 0), 0)
    if (meta.hand_size > 0 && madeTricks > meta.hand_size) {
      const tricks = `${meta.hand_size} trick${meta.hand_size === 1 ? '' : 's'}`
      return `Made bids total ${madeTricks}, but this round only has ${tricks}. Someone marked as made must have missed.`
    }

    // Once everyone is marked, the tricks left over went to the players who
    // missed, and each of them must have won a number other than their bid.
    // E.g. a missed bid of 0 needs at least one trick left for that player.
    const answered = inputs.length > 0 && inputs.every((i) => typeof i.data?.success === 'boolean')
    if (meta.hand_size > 0 && answered) {
      const left = meta.hand_size - madeTricks
      const missedBids = inputs
        .filter((i) => i.data?.success === false)
        .map((i) => Number(i.data?.bid) || 0)
      if (!canSplitMissedTricks(left, missedBids)) {
        const tricks = `${left} trick${left === 1 ? '' : 's'}`
        return `That leaves ${tricks} for the players who missed, but they can't be split so each of them missed their bid. Check who made it.`
      }
    }

    return null
  },

  getRoundSchema(round: RoundMeta): InputField[] {
    return [
      {
        key: 'trump',
        label: 'Trump',
        type: 'select',
        options: SUITS,
        scope: 'round',
        required: true,
      },
      {
        key: 'bid',
        label: 'Bid',
        type: 'number',
        min: 0,
        max: round.hand_size,
        scope: 'player',
        stepper: true,
      },
      {
        key: 'success',
        label: 'Made Bid?',
        type: 'boolean',
        scope: 'player',
      },
    ]
  },

  getRoundInfo(meta: RoundMeta, { players }): RoundInfoChip[] {
    const chips: RoundInfoChip[] = []
    const dealer = dealerChip(meta, players)
    if (dealer) chips.push(dealer)

    const trump = meta.data.trump
    if (typeof trump === 'string' && trump) {
      chips.push({
        key: 'trump',
        label: 'Trump',
        value: trump,
        history: true,
        ...(RED_SUITS.has(trump) ? { tone: 'red' as const } : {}),
      })
    }
    return chips
  },

  computeScore(_meta: RoundMeta, inputs: PlayerScoreInput[]): PlayerScoreResult[] {
    return inputs.map((i) => {
      const bid = i.data.bid ?? 0
      const success = i.data.success ?? false
      const score = success ? 10 + bid : 0
      return {
        player_id: i.player_id,
        score,
        data: { bid, success },
      }
    })
  },
}
