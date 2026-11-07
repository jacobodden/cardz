import { describe, expect, it } from 'vitest'
import { BURSTS, createBurst, stepParticles } from '../../src/celebration/particles'
import { THEMES, getTheme } from '../../src/themes'

/** A repeatable random source (mulberry32). */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const KINDS = Object.keys(BURSTS) as (keyof typeof BURSTS)[]

describe('celebration bursts', () => {
  it('each kind\'s shape weights add up to 1', () => {
    for (const kind of KINDS) {
      const total = BURSTS[kind].shapes.reduce((sum, s) => sum + s.weight, 0)
      expect(total, kind).toBeCloseTo(1)
    }
  })

  it.each(KINDS)('%s bursts upward from the origin', (kind) => {
    const burst = createBurst(kind, 200, 300, seeded(1))
    expect(burst).toHaveLength(BURSTS[kind].count)
    for (const p of burst) {
      expect([p.x, p.y]).toEqual([200, 300])
      expect(p.vy).toBeLessThan(0)
    }
  })

  it('bagel seeds mix sesame, poppy and onion flakes', () => {
    const shapes = new Set(createBurst('seeds', 0, 0, seeded(2)).map((p) => p.shape))
    expect(shapes).toEqual(new Set(['sesame', 'poppy', 'flake']))
  })

  it('is repeatable with the same random source', () => {
    expect(createBurst('confetti', 0, 0, seeded(3))).toEqual(createBurst('confetti', 0, 0, seeded(3)))
  })

  it.each(KINDS)('%s rises, then falls off screen within 6 seconds', (kind) => {
    let particles = createBurst(kind, 200, 600, seeded(4))
    const floor = 860
    let highest = 600
    let t = 0
    while (particles.length > 0 && t < 6) {
      particles = stepParticles(particles, 1 / 60, floor)
      for (const p of particles) highest = Math.min(highest, p.y)
      t += 1 / 60
    }
    // The fastest pieces climb at least 250px.
    expect(highest).toBeLessThan(350)
    expect(particles).toHaveLength(0)
  })
})

describe('theme celebrations', () => {
  it('Bagel pops seeds and Skol pops footballs', () => {
    expect(getTheme('bagel').celebration).toBe('seeds')
    expect(getTheme('skol').celebration).toBe('footballs')
  })

  it('every other theme uses the default confetti', () => {
    for (const t of THEMES.filter((t) => !['bagel', 'skol'].includes(t.id))) {
      expect(t.celebration ?? 'confetti', t.id).toBe('confetti')
    }
  })
})
