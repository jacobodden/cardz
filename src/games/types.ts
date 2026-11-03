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
  /** Display name, seeded into the `games` table. */
  name: string
  /** One-line summary shown on the game picker. */
  description: string
  minPlayers: number
  maxPlayers: number
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
  /**
   * Config defaults for the given player count. Use this when a default
   * depends on the table size (e.g. Up & Down's peak hand). Without it, the
   * schema's `defaultValue`s are used. See `getDefaultConfig()`.
   */
  getDefaultConfig?(playerCount: number): Record<string, number>
  /**
   * Check a round's inputs against the game's rules before scoring.
   * Returns a message explaining the problem, or `null` when the round is
   * valid. The session page calls it with partial inputs while the player is
   * typing (to disable Submit), and `submitRound` calls it again before saving.
   */
  validateRound?(meta: RoundMeta, inputs: PlayerScoreInput[]): string | null
}

/** Config defaults for `game` at `playerCount`, falling back to the schema. */
export function getDefaultConfig(game: CardGame, playerCount: number): Record<string, number> {
  const defaults: Record<string, number> = {}
  for (const field of game.getConfigSchema()) {
    defaults[field.key] = field.defaultValue
  }
  return { ...defaults, ...game.getDefaultConfig?.(playerCount) }
}
