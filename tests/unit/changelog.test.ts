import { describe, expect, it } from 'vitest'
import { CHANGELOG, updateToAnnounce, type ChangelogEntry } from '../../src/changelog'

describe('changelog', () => {
  it('has entries, each with a title and at least one item', () => {
    expect(CHANGELOG.length).toBeGreaterThan(0)
    for (const e of CHANGELOG) {
      expect(e.title.trim(), e.id).not.toBe('')
      expect(e.items.length, e.id).toBeGreaterThan(0)
    }
  })

  it('ids are unique', () => {
    const ids = CHANGELOG.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('ids start with their date, and dates are real YYYY-MM-DD days', () => {
    for (const e of CHANGELOG) {
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(new Date(`${e.date}T00:00:00Z`).toISOString().slice(0, 10)).toBe(e.date)
      expect(e.id.startsWith(e.date), e.id).toBe(true)
    }
  })

  it('is newest first', () => {
    const dates = CHANGELOG.map((e) => e.date)
    expect(dates).toEqual([...dates].sort().reverse())
  })
})

describe('updateToAnnounce', () => {
  const log: ChangelogEntry[] = [
    { id: '2026-02-01', date: '2026-02-01', title: 'New', items: ['b'] },
    { id: '2026-01-01', date: '2026-01-01', title: 'Old', items: ['a'] },
  ]

  it('announces the newest entry to a player who saw an older one', () => {
    expect(updateToAnnounce('2026-01-01', log)?.title).toBe('New')
  })

  it('announces it when the saved id is no longer listed', () => {
    expect(updateToAnnounce('2025-06-01', log)?.title).toBe('New')
  })

  it('stays quiet once the newest entry was seen', () => {
    expect(updateToAnnounce('2026-02-01', log)).toBeNull()
  })

  it('stays quiet on a fresh install', () => {
    expect(updateToAnnounce(null, log)).toBeNull()
  })

  it('stays quiet with an empty changelog', () => {
    expect(updateToAnnounce('2026-01-01', [])).toBeNull()
  })
})
