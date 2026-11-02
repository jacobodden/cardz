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

const BASE_URL = 'http://127.0.0.1:4173'
const OUT_ROOT = path.join('docs', 'design-history')
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

interface Capture {
  file: string
  label: string
  viewport: string
  theme: string
}

test.setTimeout(180_000)

test('capture current design history', async ({ browser }) => {
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const captures: Capture[] = []

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

      await capture(page, 'session-active', viewport.name, theme, captures)

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

      await capture(page, 'session-scored', viewport.name, theme, captures)

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

      await capture(page, 'points-active', viewport.name, theme, captures)

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
      await capture(page, 'points-complete', viewport.name, theme, captures)

      await page.goto('/')
      await page
        .getByRole('heading', { name: 'Game Sessions' })
        .waitFor()
      await capture(page, 'home-with-session', viewport.name, theme, captures)

      await page.goto('/sessions/new')
      await expect(page.getByTestId('game-option')).toHaveCount(4)
      await capture(page, 'new-session-picker', viewport.name, theme, captures)

      await context.close()
    }
  }

  writeIndex(captures)
})

async function capture(
  page: Page,
  name: string,
  viewport: string,
  theme: string,
  captures: Capture[]
): Promise<void> {
  const file = `${name}-${viewport}-${theme}.jpg`

  await resetScroll(page)

  await page.screenshot({
    path: path.join(OUT_DIR, file),
    type: 'jpeg',
    quality: 85,
  })

  captures.push({
    file,
    label: name.replace(/-/g, ' '),
    viewport,
    theme,
  })
}

function writeIndex(captures: Capture[]): void {
  const dates = fs
    .readdirSync(OUT_ROOT, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        /^\d{4}-\d{2}-\d{2}(-[\w-]+)?$/.test(entry.name)
    )
    .map((entry) => entry.name)
    .sort()
    .reverse()

  const sections = dates
    .map((date) => {
      const dir = path.join(OUT_ROOT, date)
      const files = fs
        .readdirSync(dir)
        .filter((file) => file.endsWith('.jpg'))
        .sort()

      const figures = files
        .map((file) => {
          const label = file
            .replace(/\.jpg$/, '')
            .replace(/-/g, ' ')
          return `<figure>
  <a href="${date}/${file}"><img src="${date}/${file}" alt="${label}" loading="lazy"></a>
  <figcaption>${label}</figcaption>
</figure>`
        })
        .join('\n')

      return `<section>
  <h2>${date}</h2>
  <div class="grid">
${figures}
  </div>
</section>`
    })
    .join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cardz — Design History</title>
  <style>
    :root {
      --bg: #f4f4f1;
      --surface: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --border: #e5e7eb;
    }
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 2rem 1rem 4rem;
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    header { text-align: center; margin-bottom: 2.5rem; }
    header h1 { margin: 0; font-size: 2rem; letter-spacing: -.03em; }
    header p { margin: .4rem 0 0; color: var(--muted); }
    section { margin-bottom: 3rem; }
    section h2 {
      font-size: 1.1rem;
      padding-bottom: .5rem;
      border-bottom: 1px solid var(--border);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 1rem;
      margin-top: 1rem;
    }
    figure {
      margin: 0;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    figure a { display: block; }
    figure img {
      display: block;
      width: 100%;
      height: auto;
    }
    figcaption {
      padding: .5rem .65rem;
      font-size: .75rem;
      color: var(--muted);
      border-top: 1px solid var(--border);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>Cardz — Design History</h1>
      <p>Dated captures of the current UI. Newest first. ${captures.length} images in the latest run.</p>
    </header>
${sections}
  </div>
</body>
</html>
`

  fs.writeFileSync(path.join(OUT_ROOT, 'index.html'), html)
}
