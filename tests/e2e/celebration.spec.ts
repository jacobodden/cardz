import { expect, test, type Page } from '@playwright/test'
import { createSession, finishGame, setPalette, setTheme, submitPointsRound } from '../helpers/app'

const players = ['Alice', 'Bob']

test.beforeEach(async ({ page }) => {
  await setTheme(page, 'light')
})

async function playAndFinish(page: Page) {
  await createSession(page, { gameSlug: 'high-score', title: 'Celebrate', players })
  await submitPointsRound(page, 1, [
    { player: 'Alice', points: 10 },
    { player: 'Bob', points: 4 },
  ])
  await finishGame(page)
}

test('finishing a game pops confetti from the trophy, then clears', async ({ page }) => {
  await playAndFinish(page)
  const celebration = page.getByTestId('celebration')
  await expect(celebration).toBeVisible()
  await expect(celebration).toHaveAttribute('data-kind', 'confetti')
  await expect(celebration).toBeHidden({ timeout: 10_000 })
})

test('opening a game that was already finished does not celebrate', async ({ page }) => {
  await playAndFinish(page)
  await expect(page.getByTestId('celebration')).toBeHidden({ timeout: 10_000 })
  await page.reload()
  await expect(page.getByTestId('winner-panel')).toBeVisible()
  await expect(page.getByTestId('celebration')).toBeHidden()
})

test('tapping the trophy celebrates again', async ({ page }) => {
  await playAndFinish(page)
  await page.reload()
  await page.getByRole('button', { name: 'Celebrate again' }).click()
  await expect(page.getByTestId('celebration')).toBeVisible()
})

for (const [palette, kind] of [
  ['bagel', 'seeds'],
  ['skol', 'footballs'],
] as const) {
  test(`${palette} theme pops ${kind}`, async ({ page }) => {
    await setPalette(page, palette)
    await playAndFinish(page)
    await expect(page.getByTestId('celebration')).toHaveAttribute('data-kind', kind)
    await expect(page.getByTestId('celebration')).toBeVisible()
  })
}

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' })

  test('finishing does not burst, but the trophy still does', async ({ page }) => {
    await playAndFinish(page)
    await expect(page.getByTestId('celebration')).toBeHidden()
    await page.getByRole('button', { name: 'Celebrate again' }).click()
    await expect(page.getByTestId('celebration')).toBeVisible()
  })
})
