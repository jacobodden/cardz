import { expect, test } from '@playwright/test'
import {
  createSession,
  expectNoHorizontalOverflow,
  expectPlayerTotal,
  expandHistory,
  finishGame,
  playerCard,
  sessionCard,
  setTheme,
  submitPayMeRound,
  submitPointsRound,
  submitUpAndDownRound,
} from '../helpers/app'

test.beforeEach(async ({ page }) => {
  await setTheme(page, 'light')
})

test('Up & Down: create a session and submit rounds', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'up-and-down',
    title: 'Friday Night Game',
    players: ['Alice', 'Bob', 'Carol'],
  })

  await submitUpAndDownRound(page, 1, {
    trump: '♠',
    bids: [
      { player: 'Alice', bid: 1, success: true },
      { player: 'Bob', bid: 1, success: false },
      { player: 'Carol', bid: 0, success: false },
    ],
  })

  await expectPlayerTotal(page, 'Alice', 11)

  await submitUpAndDownRound(page, 2, {
    trump: '♥',
    bids: [
      { player: 'Alice', bid: 2, success: true },
      { player: 'Bob', bid: 1, success: false },
      { player: 'Carol', bid: 0, success: false },
    ],
  })

  await expectPlayerTotal(page, 'Alice', 23)
})

test('Up & Down: rule violations disable submit and explain why', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'up-and-down',
    players: ['Alice', 'Bob', 'Carol'],
  })

  const submit = page.getByTestId('submit-round')
  const hint = page.getByTestId('round-rule-violation')

  await page.getByRole('button', { name: 'Trump ♠' }).click()
  // Round 1 has one card: a total bid of 1 breaks the hook rule.
  await playerCard(page, 'Alice').getByLabel('Alice Bid').fill('1')
  await expect(hint).toContainText('Hook rule')
  await expect(submit).toBeDisabled()

  await playerCard(page, 'Alice').getByLabel('Alice Bid').fill('0')
  await expect(hint).toBeHidden()

  // Everyone making their bid is not allowed either.
  for (const name of ['Alice', 'Bob', 'Carol']) {
    await playerCard(page, name).getByRole('button', { name: `${name} Made Bid? yes` }).click()
  }
  await expect(hint).toContainText('At least one must fail')
  await expect(submit).toBeDisabled()

  await playerCard(page, 'Carol').getByRole('button', { name: 'Carol Made Bid? no' }).click()
  await expect(hint).toBeHidden()
  await expect(submit).toBeEnabled()
})

test('Up & Down: round history keeps each round’s trump suit', async ({
  page,
}) => {
  await createSession(page, {
    gameSlug: 'up-and-down',
    title: 'Friday Night Game',
    players: ['Alice', 'Bob', 'Carol'],
  })

  await submitUpAndDownRound(page, 1, {
    trump: '♠',
    bids: [
      { player: 'Alice', bid: 1, success: true },
      { player: 'Bob', bid: 1, success: false },
      { player: 'Carol', bid: 0, success: false },
    ],
  })

  await submitUpAndDownRound(page, 2, {
    trump: '♥',
    bids: [
      { player: 'Alice', bid: 2, success: true },
      { player: 'Bob', bid: 1, success: false },
      { player: 'Carol', bid: 0, success: false },
    ],
  })

  const alice = playerCard(page, 'Alice')
  await expect(alice.getByTestId('recent-round-chip')).toHaveCount(2)
  await expect(alice.getByTestId('recent-round-chip').first()).toContainText('♠')
  await expect(alice.getByTestId('recent-round-chip').last()).toContainText('♥')

  await expandHistory(page, 'Alice')
  const history = alice.getByTestId('round-history')
  await expect(history).toContainText('♠')
  await expect(history).toContainText('♥')
})

test('Up & Down: final round completes the game automatically', async ({
  page,
}) => {
  await createSession(page, {
    gameSlug: 'up-and-down',
    title: 'Short Game',
    players: ['Alice', 'Bob', 'Carol'],
    config: { peak: 1 },
  })

  await expect(page.getByTestId('round-number')).toHaveText(/^Round 1 of 1$/)

  await page.getByRole('button', { name: 'Trump ♠' }).click()
  for (const bid of [
    { player: 'Alice', bid: 0, success: true },
    { player: 'Bob', bid: 0, success: false },
    { player: 'Carol', bid: 0, success: false },
  ]) {
    const card = playerCard(page, bid.player)
    await card.getByLabel(`${bid.player} Bid`).fill(String(bid.bid))
    await card
      .getByRole('button', {
        name: `${bid.player} Made Bid? ${bid.success ? 'yes' : 'no'}`,
      })
      .click()
  }

  await page.getByTestId('submit-round').click()

  // Fixed games keep their existing auto-completion behaviour.
  await expect(page.getByTestId('round-number')).toHaveText('Game complete')
  await expect(page.getByText('Alice wins!', { exact: false })).toBeVisible()
  await expect(page.getByTestId('submit-round')).toHaveCount(0)
})

test('Pay Me: create a session and submit a round', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'pay-me',
    title: 'Sunday Rummy',
    players: ['Alice', 'Bob'],
  })

  const wild = page.locator('[data-testid="round-info-chip"][data-chip="wild"]')
  await expect(wild).toHaveText('Wilds3s')

  await submitPayMeRound(page, 1, [
    { player: 'Alice', value: 15 },
    { player: 'Bob', value: 8 },
  ])

  await expectPlayerTotal(page, 'Alice', 15)
  await expect(wild).toHaveText('Wilds4s')
})

test('Up & Down: the dealer chip follows the rotation', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'up-and-down',
    players: ['Alice', 'Bob', 'Carol'],
    firstDealerIndex: 1,
  })

  const dealer = page.locator('[data-testid="round-info-chip"][data-chip="dealer"]')
  await expect(dealer).toHaveText('DealerBob')

  await submitUpAndDownRound(page, 1, {
    trump: '♠',
    bids: [
      { player: 'Alice', bid: 1, success: true },
      { player: 'Bob', bid: 1, success: false },
      { player: 'Carol', bid: 0, success: false },
    ],
  })

  await expect(dealer).toHaveText('DealerCarol')
})

test('High Score: open-ended rounds, negative points, and finish', async ({
  page,
}) => {
  await createSession(page, {
    gameSlug: 'high-score',
    title: 'Friday Night Game',
    players: ['Alice', 'Bob', 'Carol'],
  })

  await expect(
    page.getByText('highest total wins', { exact: false })
  ).toBeVisible()

  // Finish is disabled until at least one round has been scored.
  await expect(page.getByTestId('finish-game')).toBeDisabled()

  await submitPointsRound(page, 1, [
    { player: 'Alice', points: 10 },
    { player: 'Bob', points: -5 },
    { player: 'Carol', points: 3 },
  ])

  await expectPlayerTotal(page, 'Bob', -5)
  await expect(page.getByTestId('finish-game')).toBeEnabled()

  await submitPointsRound(page, 2, [
    { player: 'Alice', points: 2 },
    { player: 'Bob', points: 1 },
    { player: 'Carol', points: 0 },
  ])

  await expectPlayerTotal(page, 'Alice', 12)
  await expectPlayerTotal(page, 'Bob', -4)
  await expectPlayerTotal(page, 'Carol', 3)

  await finishGame(page)

  await expect(page.getByText('Alice wins!', { exact: false })).toBeVisible()
  await expect(page.getByTestId('finish-game')).toHaveCount(0)
  await expect(page.getByTestId('submit-round')).toHaveCount(0)
})

test('Low Score: lowest total wins', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'low-score',
    title: 'Sunday Rummy',
    players: ['Alice', 'Bob', 'Carol'],
  })

  await expect(
    page.getByText('lowest total wins', { exact: false })
  ).toBeVisible()

  await submitPointsRound(page, 1, [
    { player: 'Alice', points: 5 },
    { player: 'Bob', points: 8 },
    { player: 'Carol', points: 3 },
  ])

  await submitPointsRound(page, 2, [
    { player: 'Alice', points: 1 },
    { player: 'Bob', points: 2 },
    { player: 'Carol', points: 4 },
  ])

  await finishGame(page)

  await expect(page.getByText('Alice wins!', { exact: false })).toBeVisible()
})

test('Finish: undo reopens a completed game', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'high-score',
    players: ['Alice', 'Bob'],
  })

  await submitPointsRound(page, 1, [
    { player: 'Alice', points: 4 },
    { player: 'Bob', points: 2 },
  ])

  await finishGame(page)
  await expect(page.getByTestId('undo-round')).toBeVisible()

  await page.getByTestId('undo-round').click()
  await expect(page.getByTestId('round-number')).toHaveText('Round 1')
  await expect(page.getByTestId('submit-round')).toBeVisible()
})

test('Home: deleting a session updates the list from the database', async ({
  page,
}) => {
  await createSession(page, {
    gameSlug: 'high-score',
    players: ['Alice', 'Bob'],
  })

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'High Score' })).toBeVisible()

  page.once('dialog', (dialog) => dialog.accept())
  // Desktop shows an inline trash button; mobile reveals one by swiping.
  // This test is about the list reacting, so trigger whichever exists.
  await page.getByTitle('Delete session').last().dispatchEvent('click')

  await expect(page.getByText('No game sessions yet.')).toBeVisible()
})

test('Home: cards show title, game, players and leader or winner', async ({
  page,
}) => {
  await createSession(page, {
    gameSlug: 'high-score',
    title: 'Friday Night Game',
    players: ['Alice', 'Bob'],
  })
  await submitPointsRound(page, 1, [
    { player: 'Alice', points: 4 },
    { player: 'Bob', points: 9 },
  ])

  await page.goto('/')
  const card = sessionCard(page, 'Friday Night Game')
  await expect(card.getByRole('heading', { name: 'Friday Night Game' })).toBeVisible()
  await expect(card.getByTestId('session-game')).toHaveText('High Score')
  await expect(card.getByTestId('session-players')).toHaveAccessibleName('Players: Alice, Bob')
  await expect(card.getByTestId('session-standing')).toHaveText('Bob leads · 9 pts')
  await expect(card).toContainText('High Score · Round 2')

  await card.getByRole('link').click()
  await finishGame(page)
  await page.goto('/')
  await expect(card.getByTestId('session-standing')).toHaveText('Winner: Bob · 9')
})

test('Home: in-progress games sit above finished ones, filterable by game', async ({
  page,
}) => {
  await createSession(page, {
    gameSlug: 'low-score',
    title: 'Finished Rummy',
    players: ['Alice', 'Bob'],
  })
  await submitPointsRound(page, 1, [
    { player: 'Alice', points: 3 },
    { player: 'Bob', points: 5 },
  ])
  await finishGame(page)

  await createSession(page, {
    gameSlug: 'high-score',
    title: 'Live Points',
    players: ['Alice', 'Bob'],
  })

  await page.goto('/')
  const sections = page.getByTestId('session-section')
  await expect(sections).toHaveCount(2)
  await expect(sections.first().getByRole('heading', { level: 2 })).toHaveText('In progress')
  await expect(sections.first()).toContainText('Live Points')
  await expect(sections.last()).toContainText('Finished Rummy')

  const chips = page.getByTestId('game-filter')
  await expect(chips).toHaveText(['All', 'High Score', 'Low Score'])

  await page.locator('[data-testid="game-filter"][data-game-slug="low-score"]').click()
  await expect(page).toHaveURL(/\?game=low-score$/)
  await expect(page.getByTestId('session-card')).toHaveCount(1)
  await expect(sessionCard(page, 'Finished Rummy')).toBeVisible()

  // The filter survives opening a game and going back.
  await sessionCard(page, 'Finished Rummy').getByRole('link').click()
  await page.goBack()
  await expect(page.getByTestId('session-card')).toHaveCount(1)

  await page.getByRole('button', { name: 'All' }).click()
  await expect(page.getByTestId('session-card')).toHaveCount(2)
})

test('Header: icon links home, theme toggle switches, no New Game link', async ({
  page,
}) => {
  await page.goto('/sessions/new')
  const header = page.locator('header')
  await expect(header.getByRole('link', { name: /new game/i })).toHaveCount(0)

  const toggle = header.getByRole('button', { name: 'Switch to dark mode' })
  await toggle.click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await header.getByRole('button', { name: 'Switch to light mode' }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)

  const home = header.getByRole('link', { name: 'Cardz home' })
  await expect(home.locator('img')).toHaveJSProperty('complete', true)
  await expect(home.locator('img')).not.toHaveJSProperty('naturalWidth', 0)
  await home.click()
  await expect(page).toHaveURL(/\/$/)
})

test('New game: picking a game focuses the session title', async ({ page }) => {
  await page.goto('/sessions/new')
  await page.locator('[data-game-slug="pay-me"]').click()
  const title = page.getByTestId('session-title')
  await expect(title).toBeFocused()
  await expect(title).toBeInViewport()
  await page.keyboard.type('Quick Game')
  await expect(title).toHaveValue('Quick Game')
})

test('Session: unknown id shows not found instead of loading forever', async ({
  page,
}) => {
  await page.goto('/sessions/999999')
  await expect(page.getByText('Game not found.')).toBeVisible()
})

test('seeding: existing installs gain the new games', async ({ page }) => {
  await page.goto('/sessions/new')
  await expect(page.getByTestId('game-option')).toHaveCount(4)

  // Simulate an existing install that only knows the original two games.
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('cardz')
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const database = request.result
        const tx = database.transaction('games', 'readwrite')
        const store = tx.objectStore('games')
        const cursorRequest = store.openCursor()

        cursorRequest.onerror = () => reject(cursorRequest.error)
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result
          if (!cursor) return
          const value = cursor.value as { slug?: string }
          if (value.slug === 'high-score' || value.slug === 'low-score') {
            cursor.delete()
          }
          cursor.continue()
        }

        tx.oncomplete = () => {
          database.close()
          resolve()
        }
        tx.onerror = () => reject(tx.error)
      }
    })
  })

  await page.reload()
  await expect(page.getByTestId('game-option')).toHaveCount(4)
  await expect(
    page.locator('[data-testid="game-option"][data-game-slug="high-score"]')
  ).toBeVisible()
  await expect(
    page.locator('[data-testid="game-option"][data-game-slug="low-score"]')
  ).toBeVisible()
})

test('mobile: session page has no horizontal document overflow', async ({
  page,
}) => {
  await createSession(page, {
    gameSlug: 'up-and-down',
    title: 'Friday Night Game',
    players: ['Alice', 'Bob', 'Carol'],
  })

  await expectNoHorizontalOverflow(page)
})

test('mobile: home page has no horizontal overflow with long names', async ({ page }) => {
  const players = ['Bartholomew-Maximilian', 'Christopher-Alexander', 'Anastasia-Konstantina']
  await createSession(page, {
    gameSlug: 'high-score',
    title: 'An extremely long session title that will not fit on one line',
    players,
  })
  await submitPointsRound(page, 1, players.map((player, i) => ({ player, points: 1000 * (i + 1) })))
  await page.goto('/')
  await expect(page.getByTestId('session-card')).toHaveCount(1)
  await expectNoHorizontalOverflow(page)
})

test('Home: the felt band shows only on the home page', async ({ page }) => {
  await page.goto('/')
  const appBar = page.getByTestId('app-bar')
  await expect(appBar).toHaveAttribute('data-felt', 'true')
  await expect(appBar.getByRole('heading', { name: 'Games' })).toBeVisible()

  await appBar.getByRole('link', { name: 'New game' }).click()
  await expect(page).toHaveURL(/\/sessions\/new$/)
  await expect(appBar).not.toHaveAttribute('data-felt')
  await expect(appBar.getByRole('heading', { name: 'Games' })).toHaveCount(0)
})
