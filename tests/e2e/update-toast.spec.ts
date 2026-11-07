import { expect, test, type Page } from '@playwright/test'
import { CHANGELOG } from '../../src/changelog'
import { createSession, sessionCard, setSeenUpdate, setTheme } from '../helpers/app'

const latest = CHANGELOG[0]
const toast = (page: import('@playwright/test').Page) => page.getByTestId('update-toast')

test.beforeEach(async ({ page }) => {
  await setTheme(page, 'light')
})

test('a fresh install shows no update toast', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Games' })).toBeVisible()
  await expect(toast(page)).toBeHidden()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Games' })).toBeVisible()
  await expect(toast(page)).toBeHidden()
})

test('after an update, the toast links to What\'s new and shows only once', async ({ page }) => {
  await setSeenUpdate(page, '2000-01-01')
  await page.goto('/')
  await expect(toast(page)).toBeVisible()
  await expect(toast(page)).toContainText('Cardz updated')
  await expect(toast(page)).toContainText(latest.title)

  await toast(page).getByRole('link', { name: "What's new" }).click()
  await expect(page).toHaveURL(/\/changelog$/)
  await expect(page.getByRole('heading', { name: "What's new", level: 1 })).toBeVisible()
  await expect(page.getByTestId('changelog-entry')).toHaveCount(CHANGELOG.length)
  await expect(page.getByTestId('changelog-entry').first()).toContainText(latest.title)
  await expect(toast(page)).toBeHidden()

  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Games' })).toBeVisible()
  await expect(toast(page)).toBeHidden()
})

test('the update toast can be dismissed', async ({ page }) => {
  await setSeenUpdate(page, '2000-01-01')
  await page.goto('/')
  await toast(page).getByRole('button', { name: 'Dismiss' }).click()
  await expect(toast(page)).toBeHidden()
})

test('What\'s new is linked from the Games screen', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: "What's new" }).click()
  await expect(page).toHaveURL(/\/changelog$/)
  await expect(page.getByTestId('changelog-entry').first()).toBeVisible()
})

/** The What's new bar's top and bottom, and the viewport height. */
async function barBox(page: Page) {
  const box = (await page.locator('footer').boundingBox())!
  return { top: box.y, bottom: box.y + box.height, viewport: page.viewportSize()!.height }
}

test("What's new is a bar on the bottom edge of a short Games screen", async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('link', { name: "What's new" })).toBeVisible()
  const bar = await barBox(page)
  expect(Math.abs(bar.bottom - bar.viewport)).toBeLessThanOrEqual(1)
})

test("a long game list scrolls behind the What's new bar and its end clears it", async ({ page }) => {
  const titles = ['Game One', 'Game Two', 'Game Three', 'Game Four']
  for (const title of titles) {
    await createSession(page, { gameSlug: 'high-score', title, players: ['Alice', 'Bob'] })
  }
  await page.setViewportSize({ width: page.viewportSize()!.width, height: 420 })
  await page.goto('/')
  await expect(sessionCard(page, titles[0])).toBeVisible()

  // At the top the list runs on under the bar, which stays on the bottom edge.
  let bar = await barBox(page)
  expect(Math.abs(bar.bottom - bar.viewport)).toBeLessThanOrEqual(1)
  const last = sessionCard(page, titles[0]) // newest first, so the first created is last
  expect((await last.boundingBox())!.y).toBeGreaterThan(bar.top)

  // Scrolled to the end, the last game sits fully above the bar.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  bar = await barBox(page)
  expect(Math.abs(bar.bottom - bar.viewport)).toBeLessThanOrEqual(1)
  const box = (await last.boundingBox())!
  expect(box.y + box.height).toBeLessThanOrEqual(bar.top)
})
