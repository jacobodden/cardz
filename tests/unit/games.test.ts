import { describe, expect, it } from 'vitest'
import { getAllGames, getGame } from '../../src/games'
import { upAndDown } from '../../src/games/upanddown'
import { payMe } from '../../src/games/payme'
import { highScore, lowScore } from '../../src/games/points'
import { getDefaultConfig, type RoundMeta } from '../../src/games/types'

const meta = (hand_size = 0): RoundMeta => ({ round_number: 1, hand_size, data: {} })

describe('registry', () => {
  it('looks up every game by slug', () => {
    for (const game of getAllGames()) {
      expect(getGame(game.slug)).toBe(game)
    }
    expect(getAllGames().map((g) => g.slug).sort()).toEqual(
      ['high-score', 'low-score', 'pay-me', 'up-and-down'],
    )
  })

  it('returns undefined for unknown slugs', () => {
    expect(getGame('nope')).toBeUndefined()
  })

  it('gives every game a name, description and sane player limits', () => {
    for (const game of getAllGames()) {
      expect(game.name).not.toBe('')
      expect(game.description).not.toBe('')
      expect(game.minPlayers).toBeGreaterThanOrEqual(1)
      expect(game.maxPlayers).toBeGreaterThanOrEqual(game.minPlayers)
    }
  })
})

describe('getDefaultConfig', () => {
  it('falls back to schema defaults for games without the hook', () => {
    expect(getDefaultConfig(payMe, 4)).toEqual({})
    expect(getDefaultConfig(highScore, 4)).toEqual({})
  })

  it('caps the Up & Down peak by player count and the schema max', () => {
    expect(getDefaultConfig(upAndDown, 0)).toEqual({ peak: 10 })
    expect(getDefaultConfig(upAndDown, 3)).toEqual({ peak: 10 }) // 51/3 = 17, capped at 10
    expect(getDefaultConfig(upAndDown, 6)).toEqual({ peak: 8 })
    expect(getDefaultConfig(upAndDown, 7)).toEqual({ peak: 7 })
  })
})

describe('Up & Down', () => {
  const hands = (players: number, config?: Record<string, any>) =>
    upAndDown.getRounds(players, config).map((r) => r.hand_size)

  it('goes up to the configured peak and back down', () => {
    expect(hands(4, { peak: 3 })).toEqual([1, 2, 3, 2, 1])
  })

  it('numbers rounds from 1 and stores hand size in data', () => {
    const rounds = upAndDown.getRounds(4, { peak: 2 })
    expect(rounds).toEqual([
      { round_number: 1, hand_size: 1, data: { handSize: 1 } },
      { round_number: 2, hand_size: 2, data: { handSize: 2 } },
      { round_number: 3, hand_size: 1, data: { handSize: 1 } },
    ])
  })

  it('caps the peak at what a 52-card deck allows for the player count', () => {
    // 51 / 7 = 7 cards max with 7 players
    expect(Math.max(...hands(7, { peak: 10 }))).toBe(7)
    expect(hands(7, { peak: 10 })).toHaveLength(13)
  })

  it('uses the deck limit as the peak when no config is given', () => {
    // 51 / 4 = 12 with no explicit peak
    expect(Math.max(...hands(4))).toBe(12)
  })

  it('scores 10 plus the bid for a made bid, 0 otherwise', () => {
    const results = upAndDown.computeScore(meta(5), [
      { player_id: 1, data: { bid: 3, success: true } },
      { player_id: 2, data: { bid: 0, success: true } },
      { player_id: 3, data: { bid: 4, success: false } },
      { player_id: 4, data: {} },
    ])
    expect(results.map((r) => r.score)).toEqual([13, 10, 0, 0])
    expect(results[3].data).toEqual({ bid: 0, success: false })
  })

  it('limits bids to the hand size and requires a trump', () => {
    const fields = upAndDown.getRoundSchema(meta(6))
    expect(fields.find((f) => f.key === 'bid')).toMatchObject({ min: 0, max: 6, scope: 'player' })
    expect(fields.find((f) => f.key === 'trump')).toMatchObject({ scope: 'round', required: true })
  })

  describe('validateRound', () => {
    const bids = (...b: (number | undefined)[]) =>
      b.map((bid, i) => ({ player_id: i + 1, data: bid === undefined ? {} : { bid } }))

    it('rejects bids that total the hand size (hook rule)', () => {
      expect(upAndDown.validateRound!(meta(3), bids(1, 1, 1))).toMatch(
        /Hook rule: total bids \(3\) cannot equal hand size \(3\)/,
      )
    })

    it('accepts bids over or under the hand size', () => {
      expect(upAndDown.validateRound!(meta(3), bids(1, 1, 0))).toBeNull()
      expect(upAndDown.validateRound!(meta(3), bids(2, 1, 1))).toBeNull()
    })

    it('counts partial input, including numeric strings', () => {
      expect(upAndDown.validateRound!(meta(2), bids(2, undefined))).toMatch(/Hook rule/)
      expect(
        upAndDown.validateRound!(meta(2), [{ player_id: 1, data: { bid: '2' } }]),
      ).toMatch(/Hook rule/)
    })

    it('ignores the hook rule when there is no hand size', () => {
      expect(upAndDown.validateRound!(meta(0), bids(0, 0))).toBeNull()
    })

    it('requires at least one player to fail', () => {
      const made = (...m: (boolean | undefined)[]) =>
        m.map((success, i) => ({ player_id: i + 1, data: { bid: 0, success } }))
      expect(upAndDown.validateRound!(meta(5), made(true, true, true))).toMatch(/At least one must fail/)
      expect(upAndDown.validateRound!(meta(5), made(true, false, true))).toBeNull()
      // Not answered yet: not a violation
      expect(upAndDown.validateRound!(meta(5), made(true, undefined, true))).toBeNull()
    })
  })

  it('exposes the peak config with a default of 10', () => {
    expect(upAndDown.getConfigSchema()).toEqual([
      expect.objectContaining({ key: 'peak', defaultValue: 10 }),
    ])
  })
})

describe('Pay Me', () => {
  it('plays 11 rounds from 3 to 13 cards with matching wild cards', () => {
    const rounds = payMe.getRounds(4)
    expect(rounds).toHaveLength(11)
    expect(rounds[0]).toEqual({ round_number: 1, hand_size: 3, data: { handSize: 3, wildCard: 3 } })
    expect(rounds[10]).toEqual({ round_number: 11, hand_size: 13, data: { handSize: 13, wildCard: 13 } })
  })

  it('scores the value of cards left, defaulting to 0', () => {
    const results = payMe.computeScore(meta(3), [
      { player_id: 1, data: { cardValue: 25 } },
      { player_id: 2, data: {} },
    ])
    expect(results).toEqual([
      { player_id: 1, score: 25, data: { cardValue: 25 } },
      { player_id: 2, score: 0, data: { cardValue: 0 } },
    ])
  })

  it('caps the card value input at 10 points per card', () => {
    expect(payMe.getRoundSchema(meta(7))[0]).toMatchObject({ key: 'cardValue', max: 70 })
  })

  it('has low score win', () => {
    expect(payMe.scoreDirection).toBe('low')
  })
})

describe.each([
  ['High Score', highScore, 'high'],
  ['Low Score', lowScore, 'low'],
] as const)('%s', (_name, game, direction) => {
  it(`is an open game where ${direction} wins`, () => {
    expect(game.roundMode).toBe('open')
    expect(game.scoreDirection).toBe(direction)
    expect(game.getRounds(4)).toEqual([])
  })

  it('accepts numbers, numeric strings and negatives', () => {
    const results = game.computeScore(meta(), [
      { player_id: 1, data: { points: 12 } },
      { player_id: 2, data: { points: '7' } },
      { player_id: 3, data: { points: -5 } },
    ])
    expect(results.map((r) => r.score)).toEqual([12, 7, -5])
  })

  it('treats missing or non-numeric points as 0', () => {
    const results = game.computeScore(meta(), [
      { player_id: 1, data: {} },
      { player_id: 2, data: { points: 'abc' } },
      { player_id: 3, data: { points: Infinity } },
    ])
    expect(results.map((r) => r.score)).toEqual([0, 0, 0])
  })
})
