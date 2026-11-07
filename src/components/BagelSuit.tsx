import type { Suit } from '../games/types'

// Bagel theme suit art: a topping per suit, with the suit symbol in the
// cream-cheese hole so trump still reads at a glance.

/** Where the seeds sit on the bagel, as [x, y, rotation]. */
const SPOTS = [
  [9, 14, -30], [15, 7.5, 10], [25, 8, 40], [31, 15, -20],
  [8, 24, 60], [32, 25, 20], [13, 32, -40], [27, 33, 30],
] as const

interface Topping {
  name: string
  crustTop: string
  seeds: readonly string[]
  rx: number
  ry: number
}

const TOPPINGS: Record<Suit, Topping> = {
  '♠': { name: 'Poppy', crustTop: '#E2AE6C', seeds: ['#1F1A17'], rx: 1.1, ry: 1.1 },
  '♥': { name: 'Cinnamon raisin', crustTop: '#C9874E', seeds: ['#6B2A1E', '#8A3B22'], rx: 1.7, ry: 1.2 },
  '♣': { name: 'Everything', crustTop: '#E2AE6C', seeds: ['#1F1A17', '#FFF3D6', '#8A5A2B'], rx: 1.3, ry: 0.9 },
  '♦': { name: 'Cranberry', crustTop: '#E2AE6C', seeds: ['#B0263A', '#8E1E30'], rx: 1.6, ry: 1.3 },
}

/**
 * A bagel with `suit` in its hole. The symbol uses `currentColor`, so set the
 * card-red / card-black text color on it or a parent.
 */
export default function BagelSuit({ suit, size, className }: { suit: Suit; size: number; className?: string }) {
  const t = TOPPINGS[suit]
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className={className}>
      <circle cx="20" cy="20" r="18.5" fill="#C98A4B" stroke="#7A4515" strokeWidth="1.5" />
      <ellipse cx="20" cy="15.5" rx="13.5" ry="9.5" fill={t.crustTop} />
      {SPOTS.map(([x, y, r], i) => (
        <ellipse
          key={i}
          cx={x}
          cy={y}
          rx={t.rx}
          ry={t.ry}
          fill={t.seeds[i % t.seeds.length]}
          transform={`rotate(${r} ${x} ${y})`}
        />
      ))}
      <circle cx="20" cy="20" r="10" fill="#FFF8EC" stroke="#7A4515" strokeWidth="1.2" />
      <text x="20" y="25.5" textAnchor="middle" fontSize="15" fontWeight="800" fill="currentColor">
        {suit}
      </text>
    </svg>
  )
}
