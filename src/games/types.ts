export interface RoundMeta {
  round_number: number
  hand_size: number
  data: Record<string, any>
}

export interface InputField {
  key: string
  label: string
  type: 'number' | 'select' | 'boolean'
  options?: string[]
  min?: number
  max?: number
  scope?: 'round' | 'player'
  required?: boolean
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

export type ScoreDirection = 'high' | 'low'
export type RoundMode = 'fixed' | 'open'

export interface CardGame {
  slug: string
  /** Which total wins the game. */
  scoreDirection: ScoreDirection
  /** Fixed games pre-generate rounds; open games create them as they are played. */
  roundMode?: RoundMode
  /** Whether the game has a dealer that rotates each round. */
  usesDealer?: boolean
  getRounds(playerCount: number, config?: Record<string, any>): RoundMeta[]
  getRoundSchema(round: RoundMeta): InputField[]
  computeScore(meta: RoundMeta, inputs: PlayerScoreInput[]): PlayerScoreResult[]
  getConfigSchema(): ConfigField[]
}
