import { expect, test } from '@playwright/test'
import { CHANGELOG } from '../../src/changelog'
import { setSeenUpdate, setTheme } from '../helpers/app'

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

test("What's new sits at the bottom of a short Games screen", async ({ page }) => {
  await page.goto('/')
  const link = page.getByRole('link', { name: "What's new" })
  await expect(link).toBeVisible()
  const box = (await link.boundingBox())!
  const viewport = page.viewportSize()!
  // Bottom padding is 1rem; the link's box is 44px tall.
  expect(viewport.height - (box.y + box.height)).toBeLessThanOrEqual(24)
})
