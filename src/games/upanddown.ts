import type { CardGame, RoundMeta, InputField, PlayerScoreInput, PlayerScoreResult, ConfigField, RoundInfoChip } from './types'

const SUITS = ['♠', '♥', '♣', '♦']
const RED_SUITS = new Set(['♥', '♦'])
const MAX_PEAK = 10

/** Largest hand every player can be dealt from one deck (one card turned for trump). */
function maxHandSize(playerCount: number): number {
  return Math.floor(51 / playerCount)
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
    const dealer = players.find((p) => p.id === meta.data.dealer_player_id)
    if (dealer) chips.push({ key: 'dealer', label: 'Dealer', value: dealer.name })

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
