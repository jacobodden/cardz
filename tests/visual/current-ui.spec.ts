import { expect, test, type Page } from '@playwright/test'
import {
  createSession,
  finishGame,
  resetScroll,
  setPalette,
  setSeenUpdate,
  setTheme,
  submitPointsRound,
  submitUpAndDownRound,
} from '../helpers/app'

const players = ['Alice', 'Bob', 'Carol']

// Keep the winner celebration (skipped under reduced motion) out of the
// completed-session snapshots.
test.use({ reducedMotion: 'reduce' })

test.beforeEach(async ({ page }) => {
  await setTheme(page, 'light')
})

test('home page (empty)', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Games' })
  ).toBeVisible()
  await resetScroll(page)
  await expect(page).toHaveScreenshot('home-empty.png')
})

/** One finished Low Score game and one Up & Down game in progress. */
async function seedHomeSessions(page: Page) {
  // Pin the clock so card dates and month headings don't drift.
  await page.clock.setFixedTime(new Date('2026-11-03T12:00:00'))

  await createSession(page, {
    gameSlug: 'low-score',
    title: 'Sunday Rummy',
    players,
  })
  await submitPointsRound(page, 1, [
    { player: 'Alice', points: 5 },
    { player: 'Bob', points: 8 },
    { player: 'Carol', points: 3 },
  ])
  await finishGame(page)

  await createSession(page, {
    gameSlug: 'up-and-down',
    title: 'Friday Night Game',
    players,
  })
  await submitUpAndDownRound(page, 1, {
    trump: '♠',
    bids: [
      { player: 'Alice', bid: 1, success: true },
      { player: 'Bob', bid: 1, success: false },
      { player: 'Carol', bid: 1, success: false },
    ],
  })

  await page.goto('/')
  await expect(page.getByTestId('session-card')).toHaveCount(2)
  await resetScroll(page)
}

test('home page with active and finished games', async ({ page }) => {
  await seedHomeSessions(page)
  await expect(page).toHaveScreenshot('home-sessions.png')
})

test('home page in dark mode', async ({ page }) => {
  await setTheme(page, 'dark')
  await seedHomeSessions(page)
  await expect(page).toHaveScreenshot('home-sessions-dark.png')
})

test('new session picker', async ({ page }) => {
  await page.goto('/sessions/new')
  await expect(page.getByTestId('game-option')).toHaveCount(4)
  await resetScroll(page)
  await expect(page).toHaveScreenshot('new-session-picker.png')
})

test('new session form in dark mode', async ({ page }) => {
  await setTheme(page, 'dark')
  await page.goto('/sessions/new')
  await page.locator('[data-game-slug="up-and-down"]').click()
  await page.getByTestId('add-player').click()
  for (const [i, name] of players.entries()) {
    await page.getByTestId('player-name-input').nth(i).fill(name)
  }
  await page.getByTestId('player-name-input').last().blur()
  // The form below the picker, with the sticky Start bar.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(page).toHaveScreenshot('new-session-form-dark.png')
})

test('up and down active session', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'up-and-down',
    title: 'Friday Night Game',
    players,
  })

  await resetScroll(page)
  await expect(page).toHaveScreenshot('session-up-and-down-active.png')
})

test('up and down with two scored rounds', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'up-and-down',
    title: 'Friday Night Game',
    players,
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

  await resetScroll(page)
  await expect(page).toHaveScreenshot('session-up-and-down-scored.png')
})

test('pay me active session', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'pay-me',
    title: 'Sunday Rummy',
    players,
  })

  await resetScroll(page)
  await expect(page).toHaveScreenshot('session-pay-me-active.png')
})

test('high score active session', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'high-score',
    title: 'Friday Night Game',
    players,
  })

  await submitPointsRound(page, 1, [
    { player: 'Alice', points: 10 },
    { player: 'Bob', points: -5 },
    { player: 'Carol', points: 3 },
  ])

  await resetScroll(page)
  await expect(page).toHaveScreenshot('session-high-score-active.png')
})

test('low score completed session', async ({ page }) => {
  await createSession(page, {
    gameSlug: 'low-score',
    title: 'Sunday Rummy',
    players,
  })

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
  await resetScroll(page)
  await expect(page).toHaveScreenshot('session-low-score-complete.png')
})

test('dark mode active session', async ({ page }) => {
  await setTheme(page, 'dark')
  await createSession(page, {
    gameSlug: 'up-and-down',
    title: 'Friday Night Game',
    players,
  })

  await resetScroll(page)
  await expect(page).toHaveScreenshot('session-up-and-down-dark.png')
})

test("what's new page", async ({ page }) => {
  await page.goto('/changelog')
  await expect(page.getByTestId('changelog-entry').first()).toBeVisible()
  await expect(page).toHaveScreenshot('whats-new.png', { fullPage: true })
})

test('update toast after an update', async ({ page }) => {
  await setSeenUpdate(page, '2000-01-01')
  await page.goto('/')
  await expect(page.getByTestId('update-toast')).toBeVisible()
  await expect(page).toHaveScreenshot('update-toast.png')
})

test('theme picker menu open', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Color theme' }).click()
  await expect(page.getByRole('menu', { name: 'Color theme' })).toBeVisible()
  await expect(page).toHaveScreenshot('theme-picker-open.png')
})

for (const mode of ['light', 'dark'] as const) {
  test.describe(`midnight ${mode}`, () => {
    test.beforeEach(async ({ page }) => {
      await setPalette(page, 'midnight')
      await setTheme(page, mode)
    })

    test('home page', async ({ page }) => {
      await seedHomeSessions(page)
      await expect(page).toHaveScreenshot(`midnight-home-${mode}.png`)
    })

    test('up and down session with scored rounds', async ({ page }) => {
      await createSession(page, { gameSlug: 'up-and-down', title: 'Friday Night Game', players })
      await submitUpAndDownRound(page, 1, {
        trump: '♠',
        bids: [
          { player: 'Alice', bid: 1, success: true },
          { player: 'Bob', bid: 1, success: false },
          { player: 'Carol', bid: 1, success: false },
        ],
      })
      await page.getByRole('button', { name: 'Trump ♥' }).click()
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`midnight-session-${mode}.png`)
    })

    test('completed session', async ({ page }) => {
      await createSession(page, { gameSlug: 'low-score', title: 'Sunday Rummy', players })
      await submitPointsRound(page, 1, [
        { player: 'Alice', points: 5 },
        { player: 'Bob', points: 8 },
        { player: 'Carol', points: 3 },
      ])
      await finishGame(page)
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`midnight-session-complete-${mode}.png`)
    })

    test('new game form', async ({ page }) => {
      // Picking a game scrolls to the title; reduced motion makes that instant.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/sessions/new')
      await page.locator('[data-game-slug="up-and-down"]').click()
      await page.getByTestId('session-title').blur()
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`midnight-new-game-${mode}.png`)
    })
  })
}

for (const mode of ['light', 'dark'] as const) {
  test.describe(`ocean ${mode}`, () => {
    test.beforeEach(async ({ page }) => {
      await setPalette(page, 'ocean')
      await setTheme(page, mode)
    })

    test('home page', async ({ page }) => {
      await seedHomeSessions(page)
      await expect(page).toHaveScreenshot(`ocean-home-${mode}.png`)
    })

    test('up and down session with scored rounds', async ({ page }) => {
      await createSession(page, { gameSlug: 'up-and-down', title: 'Friday Night Game', players })
      await submitUpAndDownRound(page, 1, {
        trump: '♠',
        bids: [
          { player: 'Alice', bid: 1, success: true },
          { player: 'Bob', bid: 1, success: false },
          { player: 'Carol', bid: 1, success: false },
        ],
      })
      await page.getByRole('button', { name: 'Trump ♥' }).click()
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`ocean-session-${mode}.png`)
    })

    test('completed session', async ({ page }) => {
      await createSession(page, { gameSlug: 'low-score', title: 'Sunday Rummy', players })
      await submitPointsRound(page, 1, [
        { player: 'Alice', points: 5 },
        { player: 'Bob', points: 8 },
        { player: 'Carol', points: 3 },
      ])
      await finishGame(page)
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`ocean-session-complete-${mode}.png`)
    })

    test('new game form', async ({ page }) => {
      // Picking a game scrolls to the title; reduced motion makes that instant.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/sessions/new')
      await page.locator('[data-game-slug="up-and-down"]').click()
      await page.getByTestId('session-title').blur()
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`ocean-new-game-${mode}.png`)
    })
  })
}

for (const mode of ['light', 'dark'] as const) {
  test.describe(`ember ${mode}`, () => {
    test.beforeEach(async ({ page }) => {
      await setPalette(page, 'ember')
      await setTheme(page, mode)
    })

    test('home page', async ({ page }) => {
      await seedHomeSessions(page)
      await expect(page).toHaveScreenshot(`ember-home-${mode}.png`)
    })

    test('up and down session with scored rounds', async ({ page }) => {
      await createSession(page, { gameSlug: 'up-and-down', title: 'Friday Night Game', players })
      await submitUpAndDownRound(page, 1, {
        trump: '♠',
        bids: [
          { player: 'Alice', bid: 1, success: true },
          { player: 'Bob', bid: 1, success: false },
          { player: 'Carol', bid: 1, success: false },
        ],
      })
      await page.getByRole('button', { name: 'Trump ♥' }).click()
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`ember-session-${mode}.png`)
    })

    test('completed session', async ({ page }) => {
      await createSession(page, { gameSlug: 'low-score', title: 'Sunday Rummy', players })
      await submitPointsRound(page, 1, [
        { player: 'Alice', points: 5 },
        { player: 'Bob', points: 8 },
        { player: 'Carol', points: 3 },
      ])
      await finishGame(page)
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`ember-session-complete-${mode}.png`)
    })

    test('new game form', async ({ page }) => {
      // Picking a game scrolls to the title; reduced motion makes that instant.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/sessions/new')
      await page.locator('[data-game-slug="up-and-down"]').click()
      await page.getByTestId('session-title').blur()
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`ember-new-game-${mode}.png`)
    })
  })
}

for (const mode of ['light', 'dark'] as const) {
  test.describe(`graphite ${mode}`, () => {
    test.beforeEach(async ({ page }) => {
      await setPalette(page, 'graphite')
      await setTheme(page, mode)
    })

    test('home page', async ({ page }) => {
      await seedHomeSessions(page)
      await expect(page).toHaveScreenshot(`graphite-home-${mode}.png`)
    })

    test('up and down session with scored rounds', async ({ page }) => {
      await createSession(page, { gameSlug: 'up-and-down', title: 'Friday Night Game', players })
      await submitUpAndDownRound(page, 1, {
        trump: '♠',
        bids: [
          { player: 'Alice', bid: 1, success: true },
          { player: 'Bob', bid: 1, success: false },
          { player: 'Carol', bid: 1, success: false },
        ],
      })
      await page.getByRole('button', { name: 'Trump ♥' }).click()
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`graphite-session-${mode}.png`)
    })

    test('completed session', async ({ page }) => {
      await createSession(page, { gameSlug: 'low-score', title: 'Sunday Rummy', players })
      await submitPointsRound(page, 1, [
        { player: 'Alice', points: 5 },
        { player: 'Bob', points: 8 },
        { player: 'Carol', points: 3 },
      ])
      await finishGame(page)
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`graphite-session-complete-${mode}.png`)
    })

    test('new game form', async ({ page }) => {
      // Picking a game scrolls to the title; reduced motion makes that instant.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/sessions/new')
      await page.locator('[data-game-slug="up-and-down"]').click()
      await page.getByTestId('session-title').blur()
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`graphite-new-game-${mode}.png`)
    })
  })
}

for (const mode of ['light', 'dark'] as const) {
  test.describe(`bagel ${mode}`, () => {
    test.beforeEach(async ({ page }) => {
      await setPalette(page, 'bagel')
      await setTheme(page, mode)
    })

    test('home page', async ({ page }) => {
      await seedHomeSessions(page)
      await expect(page).toHaveScreenshot(`bagel-home-${mode}.png`)
    })

    test('up and down session with scored rounds', async ({ page }) => {
      await createSession(page, { gameSlug: 'up-and-down', title: 'Friday Night Game', players })
      await submitUpAndDownRound(page, 1, {
        trump: '♠',
        bids: [
          { player: 'Alice', bid: 1, success: true },
          { player: 'Bob', bid: 1, success: false },
          { player: 'Carol', bid: 1, success: false },
        ],
      })
      await page.getByRole('button', { name: 'Trump ♥' }).click()
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`bagel-session-${mode}.png`)
    })

    test('completed session', async ({ page }) => {
      await createSession(page, { gameSlug: 'low-score', title: 'Sunday Rummy', players })
      await submitPointsRound(page, 1, [
        { player: 'Alice', points: 5 },
        { player: 'Bob', points: 8 },
        { player: 'Carol', points: 3 },
      ])
      await finishGame(page)
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`bagel-session-complete-${mode}.png`)
    })

    test('new game form', async ({ page }) => {
      // Picking a game scrolls to the title; reduced motion makes that instant.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/sessions/new')
      await page.locator('[data-game-slug="up-and-down"]').click()
      await page.getByTestId('session-title').blur()
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`bagel-new-game-${mode}.png`)
    })
  })
}

for (const mode of ['light', 'dark'] as const) {
  test.describe(`skol ${mode}`, () => {
    test.beforeEach(async ({ page }) => {
      await setPalette(page, 'skol')
      await setTheme(page, mode)
    })

    test('home page', async ({ page }) => {
      await seedHomeSessions(page)
      await expect(page).toHaveScreenshot(`skol-home-${mode}.png`)
    })

    test('up and down session with scored rounds', async ({ page }) => {
      await createSession(page, { gameSlug: 'up-and-down', title: 'Friday Night Game', players })
      await submitUpAndDownRound(page, 1, {
        trump: '♠',
        bids: [
          { player: 'Alice', bid: 1, success: true },
          { player: 'Bob', bid: 1, success: false },
          { player: 'Carol', bid: 1, success: false },
        ],
      })
      await page.getByRole('button', { name: 'Trump ♥' }).click()
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`skol-session-${mode}.png`)
    })

    test('completed session', async ({ page }) => {
      await createSession(page, { gameSlug: 'low-score', title: 'Sunday Rummy', players })
      await submitPointsRound(page, 1, [
        { player: 'Alice', points: 5 },
        { player: 'Bob', points: 8 },
        { player: 'Carol', points: 3 },
      ])
      await finishGame(page)
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`skol-session-complete-${mode}.png`)
    })

    test('new game form', async ({ page }) => {
      // Picking a game scrolls to the title; reduced motion makes that instant.
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto('/sessions/new')
      await page.locator('[data-game-slug="up-and-down"]').click()
      await page.getByTestId('session-title').blur()
      await resetScroll(page)
      await expect(page).toHaveScreenshot(`skol-new-game-${mode}.png`)
    })
  })
}
