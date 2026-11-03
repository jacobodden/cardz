import type { ScoreDirection } from './types'

/**
 * The rows with the best total for `direction` (several on a tie).
 * Returns an empty array for no rows.
 */
export function topByTotal<T extends { total: number }>(rows: T[], direction: ScoreDirection): T[] {
  if (rows.length === 0) return []
  const totals = rows.map((r) => r.total)
  const target = direction === 'low' ? Math.min(...totals) : Math.max(...totals)
  return rows.filter((r) => r.total === target)
}
