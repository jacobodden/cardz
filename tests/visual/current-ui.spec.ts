import { expect, test } from '@playwright/test'
import {
  createSession,
  finishGame,
  resetScroll,
  setTheme,
  submitPointsRound,
  submitUpAndDownRound,
} from '../helpers/app'

const players = ['Alice', 'Bob', 'Carol']

test.beforeEach(async ({ page }) => {
  await setTheme(page, 'light')
})

test('home page (empty)', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Game Sessions' })
  ).toBeVisible()
  await resetScroll(page)
  await expect(page).toHaveScreenshot('home-empty.png')
})

test('new session picker', async ({ page }) => {
  await page.goto('/sessions/new')
  await expect(page.getByTestId('game-option')).toHaveCount(4)
  await resetScroll(page)
  await expect(page).toHaveScreenshot('new-session-picker.png')
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

  await resetScroll(page)
  await expect(page).toHaveScreenshot('session-up-and-down-scored.png')
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
