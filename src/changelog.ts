/**
 * What's new, newest first, in plain words for players. Shown on the
 * What's new page (/changelog).
 *
 * Adding an entry at the top is what makes an update "new": after the app
 * updates itself, players who had seen an older entry get a one-time
 * "Cardz updated" toast with the top entry's title. Builds with no new entry
 * (internal fixes, tests) update quietly.
 *
 * `id` must be unique and is never changed once shipped: it's what each
 * player's copy remembers as seen. Use the release date, with a suffix
 * (`2026-11-07b`) for a second entry on the same day.
 */

export interface ChangelogEntry {
  id: string
  /** Release date, YYYY-MM-DD. */
  date: string
  /** One line, shown in the toast and as the entry's heading. */
  title: string
  items: string[]
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    id: '2026-11-07',
    date: '2026-11-07',
    title: "Winner celebrations, and What's new",
    items: [
      "When a game ends, confetti pops from the winner's trophy. Bagel pops sesame and poppy seeds; Skol pops footballs. Tap the trophy to pop it again.",
      'After Cardz updates, a note pops up once with a link to this page.',
      'Find this page any time from the bottom of the Games screen.',
    ],
  },
  {
    id: '2026-11-06',
    date: '2026-11-06',
    title: 'Bagel and Skol themes',
    items: [
      'Bagel: toasted browns, a bagel logo, and a topping bagel for each suit.',
      'Skol: deep purple and gold with a football-field logo.',
    ],
  },
  {
    id: '2026-11-04',
    date: '2026-11-04',
    title: 'One card per player, and three new themes',
    items: [
      "Each player's total, rank, this round's entry and recent rounds share one card.",
      'New Ocean, Ember and Graphite color themes.',
    ],
  },
  {
    id: '2026-11-03',
    date: '2026-11-03',
    title: 'The Card Table look',
    items: [
      'A redesigned Games, New game and game screens on green felt.',
      'Pick a color theme from the palette button; Midnight is the first.',
      'Up & Down checks bids against the tricks in the round.',
      'On iPhone, the status bar matches the header.',
    ],
  },
  {
    id: '2026-11-01',
    date: '2026-11-01',
    title: 'High Score and Low Score',
    items: ['Two open-ended points games: play as many rounds as you like, then press Finish.'],
  },
]

/** localStorage key: the id of the newest entry this player has been shown. */
export const SEEN_UPDATE_KEY = 'lastSeenUpdate'

/**
 * The entry to announce, given the id saved as seen: the newest entry when
 * it's newer than `lastSeen`. A fresh install (nothing saved) announces
 * nothing; the caller then saves the newest id as seen.
 */
export function updateToAnnounce(
  lastSeen: string | null,
  changelog: readonly ChangelogEntry[] = CHANGELOG
): ChangelogEntry | null {
  const latest = changelog[0]
  if (!latest || lastSeen === null || lastSeen === latest.id) return null
  return latest
}
