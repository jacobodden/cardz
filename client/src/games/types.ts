export interface RoundMeta {
  round_number: number
  hand_size: number
  data: Record<string, any>
}

export interface InputField {
  key: string
  label: string
  type: 'number' | 'select'
  options?: string[]
  min?: number
  max?: number
  scope?: 'round' | 'player'
}

export interface PlayerScoreInput {
  player_id: number
  data: Record<string, any>
}

export interface PlayerScoreResult {
  player_id: number
  score: number
  data: Record<string, any>
}

export interface ConfigField {
  key: string
  label: string
  type: 'number'
  defaultValue: number
  min?: number
  max?: number
  description?: string
}

export interface CardGame {
  slug: string
  getRounds(playerCount: number, config?: Record<string, any>): RoundMeta[]
  getRoundSchema(round: RoundMeta): InputField[]
  computeScore(meta: RoundMeta, inputs: PlayerScoreInput[]): PlayerScoreResult[]
  getConfigSchema(): ConfigField[]
}
