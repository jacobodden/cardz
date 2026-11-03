import type { CardGame, RoundMeta, InputField, PlayerScoreInput, PlayerScoreResult, ConfigField, RoundInfoChip } from './types'

const FACE_NAMES: Record<number, string> = { 11: 'Jacks', 12: 'Queens', 13: 'Kings' }

/** Plural card rank for a wild card value, e.g. 3 -> "3s", 11 -> "Jacks". */
export function wildCardName(rank: number): string {
  return FACE_NAMES[rank] ?? `${rank}s`
}

export const payMe: CardGame = {
  slug: 'pay-me',
  name: 'Pay Me',
  description: 'Contract Rummy game. Lowest score after 11 rounds wins.',
  minPlayers: 2,
  maxPlayers: 6,
  scoreDirection: 'low',
  roundMode: 'fixed',
  usesDealer: false,

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

  getRoundInfo(meta: RoundMeta): RoundInfoChip[] {
    const wild = Number(meta.data.wildCard)
    if (!wild) return []
    return [{ key: 'wild', label: 'Wilds', value: wildCardName(wild) }]
  },

  computeScore(_meta: RoundMeta, inputs: PlayerScoreInput[]): PlayerScoreResult[] {
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
