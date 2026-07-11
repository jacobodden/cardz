import type { CardGame, RoundMeta, InputField, PlayerScoreInput, PlayerScoreResult, ConfigField } from './types'

const SUITS = ['♠', '♥', '♣', '♦']

export const upAndDown: CardGame = {
  slug: 'up-and-down',

  getRounds(playerCount: number, config?: Record<string, any>): RoundMeta[] {
    const defaultPeak = Math.floor(51 / playerCount)
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
        defaultValue: 10,
        min: 1,
        max: 10,
        description: 'Maximum number of cards per hand at the peak round (capped by player count)',
      },
    ]
  },

  getRoundSchema(round: RoundMeta): InputField[] {
    return [
      {
        key: 'trump',
        label: 'Trump',
        type: 'select',
        options: SUITS,
        scope: 'round',
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
        key: 'tricks',
        label: 'Tricks Won',
        type: 'number',
        min: 0,
        max: round.hand_size,
        scope: 'player',
      },
    ]
  },

  computeScore(_meta: RoundMeta, inputs: PlayerScoreInput[]): PlayerScoreResult[] {
    return inputs.map((i) => {
      const bid = i.data.bid ?? 0
      const tricks = i.data.tricks ?? 0
      const score = bid === tricks ? 10 + tricks : 0
      return {
        player_id: i.player_id,
        score,
        data: { bid, tricks },
      }
    })
  },
}
