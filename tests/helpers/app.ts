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
 * Set the app theme before the first navigation. Call this before createSession().
 * Layout.tsx reads localStorage('theme') on mount.
 */
export async function setTheme(page: Page, theme: Theme): Promise<void> {
  await page.addInitScript((value) => {
    localStorage.setItem('theme', value)
  }, theme)
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

export function playerCard(page: Page, playerName: string) {
  return page.locator(
    `[data-testid="player-card"][data-player-name="${playerName}"]`
  )
}

/** A session card on the home page, found by its displayed title. */
export function sessionCard(page: Page, title: string) {
  return page.locator(`[data-testid="session-card"][data-session-title="${title}"]`)
}

/** @deprecated Use playerCard(). */
export function playerRow(page: Page, playerName: string) {
  return playerCard(page, playerName)
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
    const card = playerCard(page, bid.player)
    await card.getByLabel(`${bid.player} Bid`).fill(String(bid.bid))
    await card
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
    const card = playerCard(page, entry.player)
    await card
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
    const card = playerCard(page, entry.player)
    await card
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

export async function expandHistory(
  page: Page,
  playerName: string
): Promise<void> {
  await playerCard(page, playerName)
    .getByRole('button', { name: `Show all rounds for ${playerName}` })
    .click()
  await expect(
    playerCard(page, playerName).getByTestId('round-history')
  ).toBeVisible()
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
