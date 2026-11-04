import { expect, test } from '@playwright/test'
import {
  createSession,
  expectNoHorizontalOverflow,
  expectPlayerTotal,
  expandHistory,
  finishGame,
  playerCard,
  sessionCard,
  setStepper,
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
      { player: 'Carol', bid: 1, success: false },
    ],
  })

  await expectPlayerTotal(page, 'Alice', 11)

  await submitUpAndDownRound(page, 2, {
    trump: '♥',
    bids: [
      { player: 'Alice', bid: 2, success: true },
      { player: 'Bob', bid: 1, success: false },
      { player: 'Carol', bid: 1, success: false },
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
  await setStepper(page, 'Alice Bid', 1)
  await expect(hint).toContainText('Hook rule')
  await expect(submit).toBeDisabled()

  await setStepper(page, 'Alice Bid', 0)
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

  // Made bids can't take more tricks than the round has: Alice and Bob
  // both bidding 1 and making it would be 2 tricks out of 1.
  await setStepper(page, 'Alice Bid', 1)
  await setStepper(page, 'Bob Bid', 1)
  await expect(hint).toContainText('Made bids total 2, but this round only has 1 trick.')
  await expect(submit).toBeDisabled()

  await playerCard(page, 'Bob').getByRole('button', { name: 'Bob Made Bid? no' }).click()

  // Alice took the only trick, so Carol (bid 0) can't have missed.
  await expect(hint).toContainText("That leaves 0 tricks for the players who missed")
  await expect(submit).toBeDisabled()

  await playerCard(page, 'Carol').getByRole('button', { name: 'Carol Made Bid? yes' }).click()
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
      { player: 'Carol', bid: 1, success: false },
    ],
  })

  await submitUpAndDownRound(page, 2, {
    trump: '♥',
    bids: [
      { player: 'Alice', bid: 2, success: true },
      { player: 'Bob', bid: 1, success: false },
      { player: 'Carol', bid: 1, success: false },
    ],
  })

  // Each card lists its own player's rounds, newest first in the DOM.
  const aliceRecent = playerCard(page, 'Alice').getByTestId('recent-round-chip')
  await expect(aliceRecent).toHaveText(['R2♥+12', 'R1♠+11'])
  await expect(playerCard(page, 'Bob').getByTestId('recent-round-chip')).toHaveText(['R2♥0', 'R1♠0'])
  await expect(aliceRecent.getByTitle('Trump').first()).toHaveClass(/text-red-suit/)

  // Only the first card carries the toggle, which controls the one table.
  const toggle = page.getByTestId('toggle-history')
  await expect(toggle).toHaveCount(1)
  await expect(playerCard(page, 'Alice').getByTestId('toggle-history')).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', 'false')

  await expandHistory(page)
  const history = page.getByTestId('round-history')
  await expect(history).toContainText('♠')
  await expect(history).toContainText('♥')
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await toggle.click()
  await expect(history).toHaveCount(0)
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
  // One trick: Alice bids 1 and takes it; Bob and Carol bid 1 and take none.
  for (const bid of [
    { player: 'Alice', bid: 1, success: true },
    { player: 'Bob', bid: 1, success: false },
    { player: 'Carol', bid: 1, success: false },
  ]) {
    await setStepper(page, `${bid.player} Bid`, bid.bid)
    await playerCard(page, bid.player)
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
  await expect(wild).toHaveText('Wilds 3s')

  await submitPayMeRound(page, 1, [
    { player: 'Alice', value: 15 },
    { player: 'Bob', value: 8 },
  ])

  await expectPlayerTotal(page, 'Alice', 15)
  await expect(wild).toHaveText('Wilds 4s')
})

test('Up & Down: the dealer chip follows the rotation', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'up-and-down',
    players: ['Alice', 'Bob', 'Carol'],
    firstDealerIndex: 1,
  })

  const dealer = page.locator('[data-testid="round-info-chip"][data-chip="dealer"]')
  await expect(dealer).toHaveText('Dealer Bob')

  await submitUpAndDownRound(page, 1, {
    trump: '♠',
    bids: [
      { player: 'Alice', bid: 1, success: true },
      { player: 'Bob', bid: 1, success: false },
      { player: 'Carol', bid: 1, success: false },
    ],
  })

  await expect(dealer).toHaveText('Dealer Carol')
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

test('New game: picking a game does not focus the title', async ({ page }) => {
  // No auto-focus: on phones it opens the keyboard and scrolls the page.
  await page.goto('/sessions/new')
  await page.locator('[data-game-slug="pay-me"]').click()
  const title = page.getByTestId('session-title')
  await expect(title).toBeVisible()
  await expect(title).not.toBeFocused()
  await title.fill('Quick Game')
  await expect(title).toHaveValue('Quick Game')
})

test('New game: the peak field can be cleared and falls back to the suggested value', async ({ page }) => {
  await page.goto('/sessions/new')
  await page.locator('[data-game-slug="up-and-down"]').click()
  for (const [i, name] of ['Ann', 'Ben', 'Cal'].entries()) {
    if (i >= 2) await page.getByTestId('add-player').click()
    await page.getByTestId('player-name-input').nth(i).fill(name)
  }
  const peak = page.getByTestId('config-peak')
  await expect(peak).toHaveValue('10')

  // Clearing leaves it empty (no stray 0), showing the suggestion as a placeholder.
  await peak.fill('')
  await expect(peak).toHaveValue('')
  await expect(peak).toHaveAttribute('placeholder', '10')
  await peak.press('Tab')
  await expect(peak).toHaveValue('')

  // Out-of-range values snap into range when leaving the field.
  await peak.fill('0')
  await peak.press('Tab')
  await expect(peak).toHaveValue('1')
  await peak.fill('25')
  await peak.press('Tab')
  await expect(peak).toHaveValue('10')

  // Starting with the field empty uses the suggested peak of 10: 19 rounds.
  await peak.fill('')
  await page.getByTestId('start-game').click()
  await expect(page.getByTestId('round-number')).toHaveText('Round 1 of 19')
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

test('Home: New game opens the new-game page in its own felt band', async ({ page }) => {
  await page.goto('/')
  const appBar = page.getByTestId('app-bar')
  await expect(appBar).toHaveAttribute('data-felt', 'true')
  await expect(appBar.getByRole('heading', { name: 'Games' })).toBeVisible()

  await appBar.getByRole('link', { name: 'New game' }).click()
  await expect(page).toHaveURL(/\/sessions\/new$/)
  await expect(appBar).toHaveAttribute('data-felt', 'true')
  await expect(appBar.getByRole('heading', { name: 'New game' })).toBeVisible()
  await expect(appBar.getByRole('heading', { name: 'Games' })).toHaveCount(0)
})

test('New game: picker marks the chosen game and Start explains what is missing', async ({ page }) => {
  await page.goto('/sessions/new')
  const upAndDown = page.locator('[data-testid="game-option"][data-game-slug="up-and-down"]')
  await expect(upAndDown).toHaveAttribute('aria-pressed', 'false')
  await upAndDown.click()
  await expect(upAndDown).toHaveAttribute('aria-pressed', 'true')

  const start = page.getByTestId('start-game')
  await expect(start).toHaveText('Start Up & Down The River')
  await expect(start).toBeDisabled()
  await expect(page.getByText('Add 3 more players to start')).toBeVisible()

  await page.getByTestId('add-player').click()
  for (const [i, name] of ['Alice', 'Bob', 'Carol'].entries()) {
    await page.getByTestId('player-name-input').nth(i).fill(name)
  }
  await expect(start).toBeEnabled()

  await page.getByRole('button', { name: 'Remove player 3' }).click()
  await expect(page.getByTestId('player-name-input')).toHaveCount(2)
  await expect(page.getByText('Add 1 more player to start')).toBeVisible()
})

test('mobile: new-game page has no horizontal overflow', async ({ page }) => {
  await page.goto('/sessions/new')
  await page.locator('[data-game-slug="up-and-down"]').click()
  await page.getByTestId('player-name-input').first().fill('Bartholomew-Maximilian')
  await expect(page.getByTestId('first-dealer')).toBeVisible()
  await expectNoHorizontalOverflow(page)
})

test('Session: felt band shows round line, trump cards and header undo', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'up-and-down',
    title: 'Friday Night Game',
    players: ['Alice', 'Bob', 'Carol'],
    firstDealerIndex: 2,
  })

  const appBar = page.getByTestId('app-bar')
  await expect(appBar).toHaveAttribute('data-felt', 'true')
  await expect(appBar.getByRole('heading', { name: 'Friday Night Game' })).toBeVisible()
  await expect(appBar.getByTestId('round-number')).toHaveText('Round 1 of 19')
  await expect(appBar).toContainText('Round 1 of 19 · Dealer Carol · 1 card')
  await expect(appBar.getByRole('progressbar', { name: 'Rounds played' })).toHaveAttribute('aria-valuenow', '0')

  const spades = appBar.getByRole('button', { name: 'Trump ♠' })
  await expect(spades).toHaveAttribute('aria-pressed', 'false')
  await spades.click()
  await expect(spades).toHaveAttribute('aria-pressed', 'true')

  // Undo appears in the header once a round is scored.
  await expect(page.getByTestId('undo-round')).toHaveCount(0)
  // One trick: Alice bids 1 and takes it; Bob and Carol bid 1 and take none.
  await setStepper(page, 'Alice Bid', 1)
  await setStepper(page, 'Bob Bid', 1)
  await setStepper(page, 'Carol Bid', 1)
  for (const [name, made] of [['Alice', 'yes'], ['Bob', 'no'], ['Carol', 'no']]) {
    await playerCard(page, name).getByRole('button', { name: `${name} Made Bid? ${made}` }).click()
  }
  await page.getByTestId('submit-round').click()
  await expect(page.getByTestId('round-number')).toHaveText('Round 2 of 19')
  await expect(page.locator('header').getByTestId('undo-round')).toBeVisible()
  await expect(playerCard(page, 'Alice').getByTestId('player-rank')).toHaveText('Leading')
  await expect(playerCard(page, 'Bob').getByTestId('player-rank')).toHaveText('2nd')

  await page.getByTestId('undo-round').click()
  await expect(page.getByTestId('round-number')).toHaveText('Round 1 of 19')
})

test('Session: bid stepper stays within 0 and the hand size', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'up-and-down',
    players: ['Alice', 'Bob', 'Carol'],
  })

  const group = page.getByRole('group', { name: 'Alice Bid', exact: true })
  const value = group.getByTestId('stepper-value')
  const progress = page.getByTestId('stepper-progress')
  await expect(value).toHaveText('–')
  await expect(progress).toHaveText('Bids so far: 0 of 3 · Alice, Bob, Carol still to bid')

  // Round 1 deals one card: + goes to 1 and stops.
  await group.getByRole('button', { name: 'Increase Alice Bid' }).click()
  await expect(value).toHaveText('1')
  await expect(group.getByRole('button', { name: 'Increase Alice Bid' })).toBeDisabled()

  await group.getByRole('button', { name: 'Decrease Alice Bid' }).click()
  await expect(value).toHaveText('0')
  await expect(group.getByRole('button', { name: 'Decrease Alice Bid' })).toBeDisabled()
  await expect(progress).toHaveText('Bids so far: 1 of 3 · Bob, Carol still to bid')
})

test('Session: completed game shows the winner panel and standings', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'low-score',
    players: ['Alice', 'Bob'],
  })
  await submitPointsRound(page, 1, [
    { player: 'Alice', points: 3 },
    { player: 'Bob', points: 5 },
  ])
  await finishGame(page)

  await expect(page.getByTestId('winner-panel')).toContainText('Alice wins!')
  await expect(page.getByTestId('winner-panel')).toContainText('Lowest total after 1 round · 3 pts')
  await expect(playerCard(page, 'Alice').getByTestId('player-rank')).toHaveText('Winner')
  await expect(playerCard(page, 'Bob').getByTestId('player-rank')).toHaveText('2nd')
  await expect(page.getByTestId('player-card')).toHaveCount(2)
  await expect(page.getByTestId('player-round-inputs')).toHaveCount(0)
  // Low score: a round's points show without a + sign.
  await expect(playerCard(page, 'Alice').getByTestId('recent-round-chip')).toHaveText(['R13'])
})

test('mobile: session page fits seven players without horizontal overflow', async ({ page }) => {
  const players = ['Bartholomew', 'Christopher', 'Anastasia', 'Dmitri', 'Evangeline', 'Fitzgerald', 'Guinevere']
  await createSession(page, { gameSlug: 'up-and-down', players })
  await expect(page.getByTestId('player-card')).toHaveCount(7)
  await expect(page.getByTestId('player-round-inputs')).toHaveCount(7)
  await expectNoHorizontalOverflow(page)
})

test('Browser theme color follows the felt band in light and dark', async ({ page }) => {
  const themeColor = page.locator('meta[name="theme-color"]')
  await page.goto('/')
  await expect(themeColor).toHaveAttribute('content', '#1e6b4e')

  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(themeColor).toHaveAttribute('content', '#174a36')
})

test('Theme picker: menu lists themes, picks one, and closes', async ({ page }) => {
  await page.goto('/')
  const button = page.locator('header').getByRole('button', { name: 'Color theme' })
  await expect(button).toHaveAttribute('aria-haspopup', 'menu')
  await expect(button).toHaveAttribute('aria-expanded', 'false')

  // Opens on the current theme; Escape closes and returns focus.
  await button.click()
  await expect(button).toHaveAttribute('aria-expanded', 'true')
  const menu = page.getByRole('menu', { name: 'Color theme' })
  const felt = menu.getByRole('menuitemradio', { name: 'Felt' })
  await expect(felt).toHaveAttribute('aria-checked', 'true')
  await expect(felt).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
  await expect(button).toBeFocused()

  // A tap outside closes it too.
  await button.click()
  await page.getByRole('heading', { name: 'Games' }).click()
  await expect(menu).toHaveCount(0)

  // Picking saves the choice, which survives a reload.
  await button.click()
  await felt.click()
  await expect(menu).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('palette'))).toBe('felt')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'felt')
})

test('Theme picker: an unknown saved theme falls back to Felt before first paint', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('palette', 'removed-theme'))
  // Record what the startup script applied, before React mounts.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      ;(window as any).__startup = {
        palette: document.documentElement.getAttribute('data-palette'),
        color: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
      }
    })
  })
  await page.goto('/')
  expect(await page.evaluate(() => (window as any).__startup)).toEqual({
    palette: 'felt',
    color: '#1e6b4e',
  })
  await expect(page.locator('html')).toHaveAttribute('data-palette', 'felt')
  // The app rewrites the stored id to the theme it actually uses.
  await expect.poll(() => page.evaluate(() => localStorage.getItem('palette'))).toBe('felt')
})

test('Startup script applies dark mode and its theme color before first paint', async ({ page }) => {
  await setTheme(page, 'dark')
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      ;(window as any).__startup = {
        dark: document.documentElement.classList.contains('dark'),
        color: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
      }
    })
  })
  await page.goto('/')
  expect(await page.evaluate(() => (window as any).__startup)).toEqual({ dark: true, color: '#174a36' })
})

test('Theme picker: switching to Midnight recolors the app and survives a reload', async ({ page }) => {
  await page.goto('/')
  const html = page.locator('html')
  const appBar = page.getByTestId('app-bar')
  const themeColor = page.locator('meta[name="theme-color"]')
  await expect(appBar).toHaveCSS('background-color', 'rgb(30, 107, 78)')

  await page.getByRole('button', { name: 'Color theme' }).click()
  await page.getByRole('menuitemradio', { name: 'Midnight' }).click()
  await expect(html).toHaveAttribute('data-palette', 'midnight')
  await expect(appBar).toHaveCSS('background-color', 'rgb(107, 63, 224)')
  await expect(themeColor).toHaveAttribute('content', '#6b3fe0')

  // Light/dark is separate and works with Midnight too.
  await page.getByRole('button', { name: 'Switch to dark mode' }).click()
  await expect(appBar).toHaveCSS('background-color', 'rgb(58, 42, 122)')
  await expect(themeColor).toHaveAttribute('content', '#3a2a7a')

  // The startup script restores both before first paint.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      ;(window as any).__startup = {
        palette: document.documentElement.getAttribute('data-palette'),
        dark: document.documentElement.classList.contains('dark'),
        color: document.querySelector('meta[name="theme-color"]')?.getAttribute('content'),
      }
    })
  })
  await page.reload()
  expect(await page.evaluate(() => (window as any).__startup)).toEqual({
    palette: 'midnight',
    dark: true,
    color: '#3a2a7a',
  })
  await page.getByRole('button', { name: 'Color theme' }).click()
  await expect(page.getByRole('menuitemradio', { name: 'Midnight' })).toHaveAttribute('aria-checked', 'true')
  await expect(page.getByRole('menuitemradio', { name: 'Felt' })).toHaveAttribute('aria-checked', 'false')
})

test('Header logo is the transparent cards-and-pencil art, not the PWA icon', async ({ page }) => {
  await page.goto('/')
  const logo = page.getByRole('link', { name: 'Cardz home' }).locator('img')
  await expect(logo).toHaveAttribute('src', /app-logo\.png$/)
  const pixels = await logo.evaluate(async (img: HTMLImageElement) => {
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth
    c.height = img.naturalHeight
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    const alpha = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3]
    const mid = Math.floor(c.width / 2)
    return { width: c.width, corner: alpha(0, 0), center: alpha(mid, mid) }
  })
  expect(pixels).toEqual({ width: 128, corner: 0, center: 255 })
})

test('Pinch-zoom is allowed and form controls are big enough to avoid iOS auto-zoom', async ({ page }) => {
  // iOS Safari zooms into any focused control under 16px.
  async function expectControlsAtLeast16px({ expectSome = false } = {}) {
    const sizes = await page
      .locator('input:visible, select:visible, textarea:visible')
      .evaluateAll((els) =>
        els.map((el) => ({
          what: el.getAttribute('aria-label') ?? el.getAttribute('data-testid') ?? el.tagName,
          px: parseFloat(getComputedStyle(el).fontSize),
        }))
      )
    if (expectSome) expect(sizes.length).toBeGreaterThan(0)
    expect(sizes.filter((s) => s.px < 16)).toEqual([])
  }

  await page.goto('/')
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content')
  expect(viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale/)

  for (const gameSlug of ['up-and-down', 'pay-me', 'high-score']) {
    await page.goto('/sessions/new')
    await page.locator(`[data-testid="game-option"][data-game-slug="${gameSlug}"]`).click()
    await page.getByTestId('player-name-input').first().waitFor()
    await expectControlsAtLeast16px({ expectSome: true })

    // Up and Down uses steppers; Pay Me and High Score type scores in.
    await createSession(page, { gameSlug, players: ['Ann', 'Ben', 'Cal'] })
    await expectControlsAtLeast16px()
  }
})

test('Header: felt under the iOS status bar, seamless with the band, pinned on scroll', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'high-score',
    title: 'Status bar',
    // A full table, so the page is tall enough to scroll.
    players: ['Ann', 'Ben', 'Cal', 'Dee', 'Eve', 'Fay', 'Gus', 'Hal', 'Ivy', 'Jo'],
  })

  // Installed on iOS, the page draws under a transparent status bar.
  const meta = (name: string) => page.locator(`meta[name="${name}"]`)
  await expect(meta('apple-mobile-web-app-status-bar-style')).toHaveAttribute('content', 'black-translucent')
  await expect(meta('apple-mobile-web-app-capable')).toHaveAttribute('content', 'yes')
  await expect(meta('viewport')).toHaveAttribute('content', /viewport-fit=cover/)

  const header = page.locator('header').locator('..')
  const band = page.getByTestId('app-bar')
  const themeColor = meta('theme-color')

  // The header, the felt band and the theme-color all match, in each theme and mode.
  const expected = [
    { felt: 'rgb(30, 107, 78)', hex: '#1e6b4e' },
    { felt: 'rgb(23, 74, 54)', hex: '#174a36' },
    { felt: 'rgb(107, 63, 224)', hex: '#6b3fe0' },
    { felt: 'rgb(58, 42, 122)', hex: '#3a2a7a' },
  ]
  for (const [i, { felt, hex }] of expected.entries()) {
    if (i === 2) {
      await page.getByRole('button', { name: 'Color theme' }).click()
      await page.getByRole('menuitemradio', { name: 'Midnight' }).click()
      await page.getByRole('button', { name: 'Switch to light mode' }).click()
    } else if (i > 0) {
      await page.getByRole('button', { name: 'Switch to dark mode' }).click()
    }
    await expect(header).toHaveCSS('background-color', felt)
    await expect(band).toHaveCSS('background-color', felt)
    await expect(themeColor).toHaveAttribute('content', hex)
  }

  // Scrolled down, the header stays pinned to the top with its buttons.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100)
  expect((await header.boundingBox())!.y).toBe(0)
  await expect(page.getByRole('link', { name: 'Cardz home' })).toBeInViewport()
})

test('Session: one card per player with name, total, rank and this round', async ({ page }) => {
  await createSession(page, { gameSlug: 'up-and-down', players: ['Alice', 'Bob', 'Carol'] })

  const cards = page.getByTestId('player-card')
  await expect(cards).toHaveCount(3)
  const alice = playerCard(page, 'Alice')
  await expect(alice.getByTestId('player-name')).toHaveText('Alice')
  await expect(alice.getByTestId('player-total')).toHaveText('0')
  // No rank and no recent rounds before anything is scored.
  await expect(page.getByTestId('player-rank')).toHaveCount(0)
  await expect(page.getByTestId('recent-round-chip')).toHaveCount(0)
  await expect(page.getByTestId('toggle-history')).toHaveCount(0)

  const inputs = alice.getByTestId('player-round-inputs')
  await expect(inputs).toContainText('This round')
  await expect(inputs.getByTestId('card-round-line')).toHaveText('R1 · 1 card')
  await expect(inputs).toContainText('Bid')
  await expect(inputs).toContainText('Made Bid?')
  await expect(inputs.getByRole('group', { name: 'Alice Bid', exact: true })).toBeVisible()
  await expect(inputs.getByRole('button', { name: 'Alice Made Bid? yes' })).toBeVisible()
})

for (const [gameSlug, label] of [
  ['pay-me', 'Cards Left (value)'],
  ['high-score', 'Points'],
  ['low-score', 'Points'],
] as const) {
  test(`Session: ${gameSlug} labels its number field inside each card`, async ({ page }) => {
    await createSession(page, { gameSlug, players: ['Alice', 'Bob'] })
    const inputs = playerCard(page, 'Bob').getByTestId('player-round-inputs')
    await expect(inputs).toContainText(label)
    await expect(inputs.getByLabel(`Bob ${label}`, { exact: true })).toBeVisible()
    await expectNoHorizontalOverflow(page)
  })
}

test('mobile: seven long names truncate inside their cards', async ({ page }) => {
  const players = [
    'Bartholomew-Maximilian-Fitzgerald',
    'Christopher-Alexander',
    'Anastasia',
    'Dmitri',
    'Evangeline',
    'Fitzgerald',
    'Guinevere',
  ]
  await createSession(page, { gameSlug: 'up-and-down', players })
  await submitUpAndDownRound(page, 1, {
    trump: '♦',
    bids: players.map((player, i) => ({ player, bid: 1, success: i === 0 })),
  })
  await expect(page.getByTestId('player-card')).toHaveCount(7)

  const name = playerCard(page, players[0]).getByTestId('player-name')
  const clipped = await name.evaluate((el) => el.scrollWidth > el.clientWidth)
  const viewport = page.viewportSize()!
  // Only phones are narrow enough to clip this name.
  if (viewport.width < 500) expect(clipped).toBe(true)
  await expect(playerCard(page, players[0]).getByTestId('player-rank')).toHaveText('Leading')
  await expectNoHorizontalOverflow(page)
})

test('Session: card controls are at least 44px tall', async ({ page }) => {
  await createSession(page, { gameSlug: 'up-and-down', players: ['Alice', 'Bob', 'Carol'] })
  await submitUpAndDownRound(page, 1, {
    trump: '♠',
    bids: [
      { player: 'Alice', bid: 1, success: true },
      { player: 'Bob', bid: 1, success: false },
      { player: 'Carol', bid: 1, success: false },
    ],
  })
  const buttons = playerCard(page, 'Alice').getByRole('button')
  const heights = await buttons.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height))
  expect(heights.length).toBeGreaterThan(0)
  for (const h of heights) expect(h).toBeGreaterThanOrEqual(44)
})
