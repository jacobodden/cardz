import type { CelebrationKind } from '../themes'

/**
 * The winner celebration's particles: a burst from a point (the trophy) that
 * flies up and falls back under gravity. Pure functions with no DOM, so the
 * physics is unit tested; `Celebration.tsx` draws them on a canvas.
 *
 * Units are CSS pixels and seconds.
 */

export type Shape = 'confetti' | 'sesame' | 'poppy' | 'flake' | 'football'

export interface Particle {
  shape: Shape
  x: number
  y: number
  vx: number
  vy: number
  /** Rotation in radians, and its speed. */
  rot: number
  spin: number
  /** Confetti and flakes flip as they fall: a phase in radians, and its speed. */
  flip: number
  flipSpeed: number
  /** Length of the shape's long side. */
  size: number
  color: string
  /** Velocity lost per second (exponential), so pieces slow and flutter down. */
  drag: number
  gravity: number
}

interface ShapeSpec {
  shape: Shape
  /** Share of the burst, 0–1. A kind's weights add up to 1. */
  weight: number
  colors: readonly string[]
  size: [number, number]
  drag: number
  gravity: number
}

interface BurstSpec {
  count: number
  speed: [number, number]
  /** Half the spread of launch angles around straight up, in radians. */
  spread: number
  shapes: readonly ShapeSpec[]
}

const CONFETTI_COLORS = ['#e8433f', '#f6b93b', '#2ecc71', '#3498db', '#9b59b6', '#ff7ab6'] as const

export const BURSTS: Record<CelebrationKind, BurstSpec> = {
  confetti: {
    count: 130,
    speed: [600, 1300],
    spread: 1.05,
    shapes: [{ shape: 'confetti', weight: 1, colors: CONFETTI_COLORS, size: [8, 12], drag: 1.6, gravity: 700 }],
  },
  // An everything bagel's toppings: mostly sesame and poppy, a few onion flakes.
  seeds: {
    count: 180,
    speed: [600, 1300],
    spread: 1.1,
    shapes: [
      { shape: 'sesame', weight: 0.55, colors: ['#f3e2b3', '#ead39a', '#fff3d6'], size: [6, 8], drag: 1.2, gravity: 1150 },
      { shape: 'poppy', weight: 0.35, colors: ['#1f1a17', '#2c2622'], size: [3, 4], drag: 1.2, gravity: 1150 },
      { shape: 'flake', weight: 0.1, colors: ['#c98a4b', '#e2ae6c'], size: [6, 9], drag: 1.8, gravity: 850 },
    ],
  },
  footballs: {
    count: 26,
    speed: [600, 1250],
    spread: 0.95,
    shapes: [{ shape: 'football', weight: 1, colors: ['#8b4a1f', '#7a3f19'], size: [24, 32], drag: 0.9, gravity: 1100 }],
  },
}

function between(random: () => number, [min, max]: [number, number]): number {
  return min + random() * (max - min)
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.min(items.length - 1, Math.floor(random() * items.length))]
}

/** The shape spec that `roll` (0–1) lands on, by weight. */
function shapeFor(shapes: readonly ShapeSpec[], roll: number): ShapeSpec {
  let total = 0
  for (const s of shapes) {
    total += s.weight
    if (roll < total) return s
  }
  return shapes[shapes.length - 1]
}

/** A burst of `kind` from (`x`, `y`). Pass `random` for repeatable bursts. */
export function createBurst(
  kind: CelebrationKind,
  x: number,
  y: number,
  random: () => number = Math.random
): Particle[] {
  const spec = BURSTS[kind]
  return Array.from({ length: spec.count }, () => {
    const s = shapeFor(spec.shapes, random())
    // Straight up is -π/2; spread either side.
    const angle = -Math.PI / 2 + (random() * 2 - 1) * spec.spread
    const speed = between(random, spec.speed)
    return {
      shape: s.shape,
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: random() * Math.PI * 2,
      spin: (random() * 2 - 1) * (s.shape === 'football' ? 9 : 12),
      flip: random() * Math.PI * 2,
      flipSpeed: 4 + random() * 8,
      size: between(random, s.size),
      color: pick(random, s.colors),
      drag: s.drag,
      gravity: s.gravity,
    }
  })
}

/**
 * Move `particles` on by `dt` seconds, in place, and return the ones still
 * on screen (above `floor`, the viewport's bottom edge plus a margin).
 */
export function stepParticles(particles: Particle[], dt: number, floor: number): Particle[] {
  for (const p of particles) {
    const keep = Math.exp(-p.drag * dt)
    p.vx *= keep
    p.vy = p.vy * keep + p.gravity * dt
    p.x += p.vx * dt
    p.y += p.vy * dt
    p.rot += p.spin * dt
    p.flip += p.flipSpeed * dt
  }
  return particles.filter((p) => p.y < floor)
}
