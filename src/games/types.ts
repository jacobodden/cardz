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
  /**
   * Enter a number field with −/+ buttons instead of typing. Suits small
   * counts with a `max`, such as a bid.
   */
  stepper?: boolean
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

/** A labelled fact about a round (trump, dealer, wild card...) shown as a chip. */
export interface RoundInfoChip {
  key: string
  label: string
  value: string
  /** Colour hint, e.g. red for hearts and diamonds. */
  tone?: 'red'
  /** Also show this chip in each player's round history, not just the current round. */
  history?: boolean
}

export interface RoundInfoContext {
  /** Players in the session, to resolve ids stored in round data (e.g. the dealer). */
  players: { id: number; name: string }[]
}

export type Suit = '♠' | '♥' | '♣' | '♦'

/** A playing card that stands for the game in lists, e.g. K♠. */
export interface CardFace {
  rank: string
  suit: Suit
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
  /** The card shown for this game on the home screen. */
  cardFace: CardFace
  /** Fixed games pre-generate rounds; open games create them as they are played. */
  roundMode?: RoundMode
  /**
   * Whether the game has a dealer that rotates each round (see dealer.ts).
   * Fixed games set every round's dealer up front; open games pass the deal
   * to the next seat after each round, and players can move it at will.
   */
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
  /**
   * Facts about a round to show as chips: the current round's chips appear
   * above the score inputs, and chips marked `history` also appear in each
   * player's round history. `meta.data` is the round's stored data, so
   * values entered while scoring (e.g. trump) show once the round is saved.
   */
  getRoundInfo?(meta: RoundMeta, context: RoundInfoContext): RoundInfoChip[]
}

/** Config defaults for `game` at `playerCount`, falling back to the schema. */
export function getDefaultConfig(game: CardGame, playerCount: number): Record<string, number> {
  const defaults: Record<string, number> = {}
  for (const field of game.getConfigSchema()) {
    defaults[field.key] = field.defaultValue
  }
  return { ...defaults, ...game.getDefaultConfig?.(playerCount) }
}
