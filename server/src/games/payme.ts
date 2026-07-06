import type { CardGame, RoundMeta, InputField, PlayerScoreInput, PlayerScoreResult, ConfigField } from './types.js'

export const payMe: CardGame = {
  slug: 'pay-me',

  getConfigSchema(): ConfigField[] {
    return []
  },

  getRounds(_playerCount: number, _config?: Record<string, any>): RoundMeta[] {
    const rounds: RoundMeta[] = []
    for (let i = 3; i <= 13; i++) {
      rounds.push({
        round_number: i - 2,
        hand_size: i,
        data: { handSize: i, wildCard: i },
      })
    }
    return rounds
  },

  getRoundSchema(round: RoundMeta): InputField[] {
    return [
      {
        key: 'cardValue',
        label: 'Cards Left (value)',
        type: 'number',
        min: 0,
        max: round.hand_size * 10,
      },
    ]
  },

  computeScore(meta: RoundMeta, inputs: PlayerScoreInput[]): PlayerScoreResult[] {
    return inputs.map((i) => {
      const cardValue = i.data.cardValue ?? 0
      return {
        player_id: i.player_id,
        score: cardValue,
        data: { cardValue },
      }
    })
  },
}
