import { expect, test, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import {
  createSession,
  finishGame,
  resetScroll,
  submitPointsRound,
  submitUpAndDownRound,
} from '../helpers/app'
import { GALLERY_ROOT, writeGalleryIndex } from './gallery'

const BASE_URL = 'http://127.0.0.1:4173'
const OUT_ROOT = GALLERY_ROOT
const DATE = new Date().toISOString().slice(0, 10)
const OUT_DIR = path.join(OUT_ROOT, DATE)

const VIEWPORTS = [
  {
    name: 'mobile',
    width: 390,
    height: 844,
    isMobile: true,
    hasTouch: true,
  },
  {
    name: 'desktop',
    width: 1280,
    height: 800,
    isMobile: false,
    hasTouch: false,
  },
] as const

const THEMES = ['light', 'dark'] as const

test.setTimeout(180_000)

test('capture current design history', async ({ browser }) => {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  for (const theme of THEMES) {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        baseURL: BASE_URL,
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
        isMobile: viewport.isMobile,
        hasTouch: viewport.hasTouch,
        colorScheme: theme,
      })

      await context.addInitScript((value) => {
        localStorage.setItem('theme', value)
      }, theme)

      const page = await context.newPage()

      await createSession(page, {
        gameSlug: 'up-and-down',
        title: 'Friday Night Game',
        players: ['Alice', 'Bob', 'Carol'],
      })

      await capture(page, 'session-active', viewport.name, theme)

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

      await capture(page, 'session-scored', viewport.name, theme)

      await createSession(page, {
        gameSlug: 'high-score',
        title: 'Friday Night Game',
        players: ['Alice', 'Bob', 'Carol'],
      })

      await submitPointsRound(page, 1, [
        { player: 'Alice', points: 10 },
        { player: 'Bob', points: -5 },
        { player: 'Carol', points: 3 },
      ])

      await capture(page, 'points-active', viewport.name, theme)

      await createSession(page, {
        gameSlug: 'low-score',
        title: 'Sunday Rummy',
        players: ['Alice', 'Bob', 'Carol'],
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
      await capture(page, 'points-complete', viewport.name, theme)

      await page.goto('/')
      await page
        .getByRole('heading', { name: 'Game Sessions' })
        .waitFor()
      await capture(page, 'home-with-session', viewport.name, theme)

      await page.goto('/sessions/new')
      await expect(page.getByTestId('game-option')).toHaveCount(4)
      await capture(page, 'new-session-picker', viewport.name, theme)

      await context.close()
    }
  }

  writeGalleryIndex(OUT_ROOT)
})

async function capture(
  page: Page,
  name: string,
  viewport: string,
  theme: string
): Promise<void> {
  const file = `${name}-${viewport}-${theme}.jpg`

  await resetScroll(page)

  await page.screenshot({
    path: path.join(OUT_DIR, file),
    type: 'jpeg',
    quality: 85,
  })
}
