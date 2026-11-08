import { expect, test, type Page } from '@playwright/test'
import {
  createSession,
  finishGame,
  playerCard,
  setTheme,
  submitPointsRound,
  submitUpAndDownRound,
} from '../helpers/app'

const players = ['Alice', 'Bob', 'Carol']

test.beforeEach(async ({ page }) => {
  await setTheme(page, 'light')
})

async function expectDealer(page: Page, name: string) {
  await expect(playerCard(page, name).getByTestId('dealer-chip')).toBeVisible()
  await expect(page.getByTestId('dealer-chip')).toHaveCount(1)
  await expect(page.locator('[data-testid="round-info-chip"][data-chip="dealer"]')).toHaveText(`Dealer ${name}`)
}

const points = (values: number[]) => players.map((player, i) => ({ player, points: values[i] }))

test('High Score: the chosen first dealer gets the chip, and the deal passes each round', async ({ page }) => {
  await createSession(page, { gameSlug: 'high-score', players, firstDealerIndex: 1 })
  await expectDealer(page, 'Bob')

  await submitPointsRound(page, 1, points([5, 3, 8]))
  await expectDealer(page, 'Carol')

  await submitPointsRound(page, 2, points([5, 3, 8]))
  await expectDealer(page, 'Alice')
})

test('Low Score: tap a player\'s D to make them the dealer; undo restores the dealer', async ({ page }) => {
  await createSession(page, { gameSlug: 'low-score', players })
  await expectDealer(page, 'Alice')

  await playerCard(page, 'Carol').getByRole('button', { name: 'Make Carol the dealer' }).click()
  await expectDealer(page, 'Carol')
  // The move is saved with the round.
  await page.reload()
  await expectDealer(page, 'Carol')

  await submitPointsRound(page, 1, points([5, 3, 8]))
  await expectDealer(page, 'Alice')

  await page.getByTestId('undo-round').click()
  await expect(page.getByTestId('round-number')).toHaveText('Round 1')
  await expectDealer(page, 'Carol')
})

test('the dealer chip leaves when the game is finished', async ({ page }) => {
  await createSession(page, { gameSlug: 'high-score', players })
  await submitPointsRound(page, 1, points([5, 3, 8]))
  await finishGame(page)
  await expect(page.getByTestId('dealer-chip')).toHaveCount(0)
  await expect(page.getByTestId('make-dealer')).toHaveCount(0)
})

test("Up & Down keeps its fixed dealer schedule, with no dealer chips", async ({ page }) => {
  await createSession(page, { gameSlug: 'up-and-down', players })
  await expect(page.locator('[data-testid="round-info-chip"][data-chip="dealer"]')).toHaveText('Dealer Alice')
  await expect(page.getByTestId('dealer-chip')).toHaveCount(0)
  await expect(page.getByTestId('make-dealer')).toHaveCount(0)
  await submitUpAndDownRound(page, 1, {
    trump: '♠',
    bids: [
      { player: 'Alice', bid: 1, success: true },
      { player: 'Bob', bid: 1, success: false },
      { player: 'Carol', bid: 1, success: false },
    ],
  })
  await expect(page.locator('[data-testid="round-info-chip"][data-chip="dealer"]')).toHaveText('Dealer Bob')
})

test('the make-dealer button is a 44px tap target', async ({ page }) => {
  await createSession(page, { gameSlug: 'high-score', players })
  const box = (await playerCard(page, 'Bob').getByRole('button', { name: 'Make Bob the dealer' }).boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(box.width).toBeGreaterThanOrEqual(44)
})
