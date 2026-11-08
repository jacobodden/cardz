import { describe, expect, it } from 'vitest'
import { getAllGames, getGame } from '../../src/games'
import { canSplitMissedTricks, upAndDown } from '../../src/games/upanddown'
import { payMe } from '../../src/games/payme'
import { highScore, lowScore } from '../../src/games/points'
import { nextDealerId } from '../../src/games/dealer'
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

    describe('made bids cannot exceed the tricks in the round', () => {
      const round = (...players: [bid: number, success?: boolean][]) =>
        players.map(([bid, success], i) => ({ player_id: i + 1, data: { bid, success } }))

      it('rejects made bids that total more than the hand size', () => {
        // 3 tricks: Alice (2) and Bob (2) can't both have made it.
        expect(upAndDown.validateRound!(meta(3), round([2, true], [2, true], [0, false]))).toBe(
          'Made bids total 4, but this round only has 3 tricks. Someone marked as made must have missed.',
        )
        expect(upAndDown.validateRound!(meta(1), round([1, true], [1, true], [0, false]))).toMatch(
          /only has 1 trick\./,
        )
      })

      it('accepts made bids up to the hand size', () => {
        // Exactly all 3 tricks taken by players who made it; Carol (bid 1) took none.
        expect(upAndDown.validateRound!(meta(3), round([2, true], [1, true], [1, false]))).toBeNull()
        expect(upAndDown.validateRound!(meta(3), round([2, true], [0, true], [2, false]))).toBeNull()
      })

      it('counts only players marked as made, including partial input', () => {
        // Bob's bid of 3 doesn't count until he is marked as made.
        expect(upAndDown.validateRound!(meta(3), round([2, true], [3, false], [1]))).toBeNull()
        expect(upAndDown.validateRound!(meta(3), round([2, true], [3], [1]))).toBeNull()
        expect(upAndDown.validateRound!(meta(3), round([2, true], [3, true], [1]))).toMatch(/Made bids total 5/)
      })
    })

    describe('the tricks left must fit the players who missed', () => {
      const round = (...players: [bid: number, success?: boolean][]) =>
        players.map(([bid, success], i) => ({ player_id: i + 1, data: { bid, success } }))

      it('rejects a missed bid of 0 when no tricks are left', () => {
        // 3 tricks, all taken by Alice (2) and Bob (1); Carol missing 0 needs one.
        // (Dee's bid keeps the total off the hand size, so the hook rule passes.)
        expect(upAndDown.validateRound!(meta(3), round([2, true], [1, true], [0, false], [1, false]))).toBe(
          "That leaves 0 tricks for the players who missed, but they can't be split so each of them missed their bid. Check who made it.",
        )
      })

      it('rejects a leftover that every split would hand someone their bid', () => {
        // 1 trick left for Bob (bid 1) and Cal (bid 1): whoever wins it made their bid.
        expect(upAndDown.validateRound!(meta(3), round([2, true], [1, false], [1, false]))).toMatch(
          /leaves 1 trick for the players who missed/,
        )
      })

      it('accepts leftovers that can be split', () => {
        // 1 trick left: Bob (bid 0) wins it, Cal (bid 2) wins none.
        expect(upAndDown.validateRound!(meta(3), round([2, true], [0, false], [2, false]))).toBeNull()
        // 2 tricks left: Bob (bid 1) wins both, Cal (bid 2) none.
        expect(upAndDown.validateRound!(meta(3), round([1, true], [1, false], [2, false]))).toBeNull()
        // Nobody made it: 3 tricks among bids 1, 1, 0 (e.g. 0, 2, 1).
        expect(upAndDown.validateRound!(meta(3), round([1, false], [1, false], [0, false]))).toBeNull()
      })

      it('waits until every player is marked', () => {
        expect(upAndDown.validateRound!(meta(3), round([2, true], [1, true], [0, false], [1]))).toBeNull()
      })

      it('canSplitMissedTricks covers the edge cases', () => {
        expect(canSplitMissedTricks(0, [])).toBe(true)
        expect(canSplitMissedTricks(1, [])).toBe(false)
        expect(canSplitMissedTricks(0, [0])).toBe(false)
        expect(canSplitMissedTricks(0, [3])).toBe(true)
        expect(canSplitMissedTricks(2, [2])).toBe(false)
        expect(canSplitMissedTricks(2, [1, 1])).toBe(true)
        expect(canSplitMissedTricks(1, [1, 1])).toBe(false)
        expect(canSplitMissedTricks(2, [0, 0])).toBe(true)
        expect(canSplitMissedTricks(1, [0, 0])).toBe(false)
      })
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

describe('getRoundInfo', () => {
  const players = [
    { id: 1, name: 'Ann' },
    { id: 2, name: 'Bob' },
  ]
  const meta = (data: Record<string, any>): RoundMeta => ({ round_number: 1, hand_size: 3, data })

  it('Up & Down shows the dealer, and trump once chosen (red for red suits)', () => {
    expect(upAndDown.getRoundInfo!(meta({ dealer_player_id: 2 }), { players })).toEqual([
      { key: 'dealer', label: 'Dealer', value: 'Bob' },
    ])
    expect(upAndDown.getRoundInfo!(meta({ dealer_player_id: 1, trump: '♥' }), { players })).toEqual([
      { key: 'dealer', label: 'Dealer', value: 'Ann' },
      { key: 'trump', label: 'Trump', value: '♥', history: true, tone: 'red' },
    ])
    expect(upAndDown.getRoundInfo!(meta({ trump: '♠' }), { players })).toEqual([
      { key: 'trump', label: 'Trump', value: '♠', history: true },
    ])
  })

  it('Pay Me shows the wild card for every round', () => {
    const rounds = payMe.getRounds(2)
    const wilds = rounds.map((r) => payMe.getRoundInfo!(r, { players })[0]?.value)
    expect(wilds).toEqual(['3s', '4s', '5s', '6s', '7s', '8s', '9s', '10s', 'Jacks', 'Queens', 'Kings'])
    expect(payMe.getRoundInfo!(rounds[0], { players })[0]).toMatchObject({ label: 'Wilds' })
  })
})

describe('dealer', () => {
  const seats = [
    { id: 7, order_index: 2 },
    { id: 5, order_index: 0 },
    { id: 9, order_index: 1 },
  ]

  it('passes to the next seat by order, wrapping around', () => {
    expect(nextDealerId(seats, 5)).toBe(9)
    expect(nextDealerId(seats, 9)).toBe(7)
    expect(nextDealerId(seats, 7)).toBe(5)
  })

  it('has no next dealer without a seated current one', () => {
    expect(nextDealerId(seats, undefined)).toBeUndefined()
    expect(nextDealerId(seats, 42)).toBeUndefined()
  })

  it('High and Low Score show the round dealer as a chip', () => {
    const players = [{ id: 5, name: 'Ann' }]
    for (const game of [highScore, lowScore]) {
      expect(game.usesDealer).toBe(true)
      const info = game.getRoundInfo!({ round_number: 1, hand_size: 0, data: { dealer_player_id: 5 } }, { players })
      expect(info).toEqual([{ key: 'dealer', label: 'Dealer', value: 'Ann' }])
      expect(game.getRoundInfo!({ round_number: 1, hand_size: 0, data: {} }, { players })).toEqual([])
    }
  })
})
