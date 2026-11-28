import { expect, test, type Page } from '@playwright/test'
import {
  createSession,
  editSavedRows,
  finishGame,
  playerCard,
  setTheme,
  submitPayMeRound,
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

async function expectNoDealer(page: Page) {
  await expect(page.getByTestId('dealer-chip')).toHaveCount(0)
  await expect(page.getByTestId('make-dealer')).toHaveCount(0)
  await expect(page.locator('[data-testid="round-info-chip"][data-chip="dealer"]')).toHaveCount(0)
}

const cards = (values: number[]) => players.map((player, i) => ({ player, value: values[i] }))

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
  await expectNoDealer(page)
})

test('Up & Down shows its fixed dealer schedule with a D that can\'t be moved', async ({ page }) => {
  await createSession(page, { gameSlug: 'up-and-down', players })
  await expectDealer(page, 'Alice')
  await expect(page.getByTestId('make-dealer')).toHaveCount(0)
  await submitUpAndDownRound(page, 1, {
    trump: '♠',
    bids: [
      { player: 'Alice', bid: 1, success: true },
      { player: 'Bob', bid: 1, success: false },
      { player: 'Carol', bid: 1, success: false },
    ],
  })
  await expectDealer(page, 'Bob')
})

test('Pay Me: the D starts on the chosen first dealer and passes each round', async ({ page }) => {
  await createSession(page, { gameSlug: 'pay-me', players, firstDealerIndex: 2 })
  await expectDealer(page, 'Carol')
  await expect(page.getByTestId('make-dealer')).toHaveCount(0)
  await submitPayMeRound(page, 1, cards([0, 5, 12]))
  await expectDealer(page, 'Alice')
  await submitPayMeRound(page, 2, cards([3, 0, 8]))
  await expectDealer(page, 'Bob')
})

test('Pay Me: a game started before Pay Me had a dealer shows no D', async ({ page }) => {
  await createSession(page, { gameSlug: 'pay-me', players })
  await expectDealer(page, 'Alice')

  // Take the dealer out of the saved game, as it was saved before this change.
  await editSavedRows(page, 'sessions', (session) => {
    for (const round of session.config_json.round_configs) delete round.data.dealer_player_id
    return session
  })
  await editSavedRows(page, 'rounds', (round) => {
    delete round.data_json.dealer_player_id
    return round
  })
  await page.reload()

  await expect(page.locator('[data-testid="round-info-chip"][data-chip="wild"]')).toBeVisible()
  await expectNoDealer(page)
  await submitPayMeRound(page, 1, cards([0, 5, 12]))
  await expectNoDealer(page)
})

/** Open the New game page for Pay Me with these names (blank for an empty slot). */
async function newPayMe(page: Page, names: string[]) {
  await page.goto('/sessions/new')
  await page.locator('[data-testid="game-option"][data-game-slug="pay-me"]').click()
  for (let i = 2; i < names.length; i++) await page.getByTestId('add-player').click()
  for (const [i, name] of names.entries()) await page.getByTestId('player-name-input').nth(i).fill(name)
}

async function start(page: Page) {
  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('round-number')).toBeVisible()
}

test('First dealer: a blank name slot is not offered and does not shift the pick', async ({ page }) => {
  await newPayMe(page, ['Alice', '', 'Carol'])
  await expect(page.getByTestId('first-dealer').locator('option')).toHaveText(['Alice', 'Carol'])
  await page.getByTestId('first-dealer').selectOption({ label: 'Carol' })
  await start(page)
  await expectDealer(page, 'Carol')
})

test('First dealer: removing a player above the pick keeps the same dealer', async ({ page }) => {
  await newPayMe(page, ['Alice', 'Bob', 'Carol'])
  await page.getByTestId('first-dealer').selectOption({ label: 'Bob' })
  await page.getByRole('button', { name: 'Remove player 1' }).click()
  await expect(page.getByTestId('first-dealer').locator('option:checked')).toHaveText('Bob')
  await start(page)
  await expectDealer(page, 'Bob')
})

test('the make-dealer button is a 44px tap target', async ({ page }) => {
  await createSession(page, { gameSlug: 'high-score', players })
  const box = (await playerCard(page, 'Bob').getByRole('button', { name: 'Make Bob the dealer' }).boundingBox())!
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(box.width).toBeGreaterThanOrEqual(44)
})
