import { expect, type Page } from '@playwright/test'

export type Theme = 'light' | 'dark'

export type GameSlug = 'up-and-down' | 'pay-me' | 'high-score' | 'low-score'

export interface CreateSessionOptions {
  gameSlug: GameSlug
  title?: string
  players: string[]
  config?: {
    peak?: number
  }
  firstDealerIndex?: number
}

/**
 * Seed localStorage `key` with `value` before the page's scripts run, like
 * a setting saved on an earlier visit. Init scripts run on every
 * navigation, so this only seeds the tab's first page: after that, what the
 * app saves (e.g. the user toggling dark mode) survives reloads.
 */
async function seedStorage(page: Page, key: string, value: string): Promise<void> {
  await page.addInitScript(
    ([k, v]) => {
      try {
        if (sessionStorage.getItem('cardz-test-seeded')) return
        localStorage.setItem(k, v)
        // Mark after every init script has run on this first page.
        addEventListener('DOMContentLoaded', () => sessionStorage.setItem('cardz-test-seeded', '1'))
      } catch {
        // about:blank and other opaque origins have no storage.
      }
    },
    [key, value] as const
  )
}

/**
 * Set light or dark mode before the first navigation. Call this before
 * createSession(). A later call wins over an earlier one.
 */
export async function setTheme(page: Page, theme: Theme): Promise<void> {
  await seedStorage(page, 'theme', theme)
}

/** Set the color theme (see src/themes.ts) before the first navigation. */
export async function setPalette(page: Page, palette: string): Promise<void> {
  await seedStorage(page, 'palette', palette)
}

/**
 * Save `id` as the newest What's new entry this player has seen (see
 * src/changelog.ts), as a copy that ran an earlier build would have.
 */
export async function setSeenUpdate(page: Page, id: string): Promise<void> {
  await seedStorage(page, 'lastSeenUpdate', id)
}

/**
 * Create a session through the UI and wait for the session screen to be ready.
 */
export async function createSession(
  page: Page,
  options: CreateSessionOptions
): Promise<void> {
  const { gameSlug, title, players, config, firstDealerIndex } = options

  await page.goto('/sessions/new')
  await expect(page.getByTestId('game-option').first()).toBeVisible()

  await page
    .locator(`[data-testid="game-option"][data-game-slug="${gameSlug}"]`)
    .click()

  if (title) {
    await page.getByTestId('session-title').fill(title)
  }

  for (let i = 0; i < players.length; i++) {
    if (i >= 2) {
      await page.getByTestId('add-player').click()
    }
    await page.getByTestId('player-name-input').nth(i).fill(players[i])
  }

  if (config?.peak !== undefined) {
    await page.getByTestId('config-peak').fill(String(config.peak))
  }

  if (firstDealerIndex !== undefined) {
    await expect(page.getByTestId('first-dealer')).toBeVisible()
    await page.getByTestId('first-dealer').selectOption(String(firstDealerIndex))
  }

  await expect(page.getByTestId('start-game')).toBeEnabled()
  await page.getByTestId('start-game').click()

  await expect(page).toHaveURL(/\/sessions\/\d+$/)
  await expect(page.getByTestId('round-number')).toBeVisible()
}

/**
 * A player's card on the session page: name, total, rank badge, this
 * round's inputs and their recent rounds.
 */
export function playerCard(page: Page, playerName: string) {
  return page.locator(
    `[data-testid="player-card"][data-player-name="${playerName}"]`
  )
}

/**
 * Set a −/+ stepper (e.g. "Alice Bid") to `value`. The first − sets the
 * minimum (0), then + counts up.
 */
export async function setStepper(
  page: Page,
  label: string,
  value: number
): Promise<void> {
  const group = page.getByRole('group', { name: label, exact: true })
  const shown = group.getByTestId('stepper-value')
  const decrease = group.getByRole('button', { name: `Decrease ${label}` })
  const increase = group.getByRole('button', { name: `Increase ${label}` })

  if ((await shown.textContent()) === '–') await decrease.click()
  let current = Number(await shown.textContent())
  while (current > value) {
    await decrease.click()
    current--
  }
  while (current < value) {
    await increase.click()
    current++
  }
  await expect(shown).toHaveText(String(value))
}

/** A session card on the home page, found by its displayed title. */
export function sessionCard(page: Page, title: string) {
  return page.locator(`[data-testid="session-card"][data-session-title="${title}"]`)
}

export async function expectPlayerTotal(
  page: Page,
  playerName: string,
  total: number | string
): Promise<void> {
  await expect(
    playerCard(page, playerName).getByTestId('player-total')
  ).toHaveText(String(total))
}

async function expectRound(page: Page, roundNumber: number): Promise<void> {
  await expect(page.getByTestId('round-number')).toHaveText(
    new RegExp(`^Round ${roundNumber}( of \\d+)?$`)
  )
}

/**
 * Fill and submit an Up & Down round. Waits for the next round to appear.
 */
export async function submitUpAndDownRound(
  page: Page,
  roundNumber: number,
  input: {
    trump: string
    bids: { player: string; bid: number; success: boolean }[]
  }
): Promise<void> {
  await expectRound(page, roundNumber)

  await page.getByRole('button', { name: `Trump ${input.trump}` }).click()

  for (const bid of input.bids) {
    await setStepper(page, `${bid.player} Bid`, bid.bid)
    await playerCard(page, bid.player)
      .getByRole('button', {
        name: `${bid.player} Made Bid? ${bid.success ? 'yes' : 'no'}`,
      })
      .click()
  }

  await page.getByTestId('submit-round').click()

  await expectRound(page, roundNumber + 1)
}

/**
 * Fill and submit a Pay Me round. Waits for the next round to appear.
 */
export async function submitPayMeRound(
  page: Page,
  roundNumber: number,
  cardValues: { player: string; value: number }[]
): Promise<void> {
  await expectRound(page, roundNumber)

  for (const entry of cardValues) {
    await playerCard(page, entry.player)
      .getByLabel(`${entry.player} Cards Left (value)`)
      .fill(String(entry.value))
  }

  await page.getByTestId('submit-round').click()

  await expectRound(page, roundNumber + 1)
}

/**
 * Fill and submit a High Score / Low Score round. Waits for the next round.
 */
export async function submitPointsRound(
  page: Page,
  roundNumber: number,
  points: { player: string; points: number }[]
): Promise<void> {
  await expectRound(page, roundNumber)

  for (const entry of points) {
    await playerCard(page, entry.player)
      .getByRole('spinbutton', { name: `${entry.player} Points` })
      .fill(String(entry.points))
  }

  await page.getByTestId('submit-round').click()

  await expectRound(page, roundNumber + 1)
}

/**
 * Press Finish and wait for the completed-state banner.
 */
export async function finishGame(page: Page): Promise<void> {
  await page.getByTestId('finish-game').click()
  await expect(page.getByTestId('round-number')).toHaveText('Game complete')
}

/** Open the full round-by-round table on the session page. */
export async function expandHistory(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'All rounds' }).click()
  await expect(page.getByTestId('round-history')).toBeVisible()
}

export async function resetScroll(page: Page): Promise<void> {
  await page.evaluate(() => window.scrollTo(0, 0))
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const hasOverflow = await page.evaluate(() => {
    const doc = document.documentElement
    return doc.scrollWidth > doc.clientWidth
  })

  expect(hasOverflow, 'document should not scroll horizontally').toBe(false)
}
