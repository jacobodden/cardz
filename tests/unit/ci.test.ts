import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import playwrightPackage from '@playwright/test/package.json' with { type: 'json' }

describe('CI visual job', () => {
  it('runs in the Playwright image matching the installed version', () => {
    // Local `npm run test:visual` picks the image from the installed version,
    // so CI must use the same tag or baselines will differ.
    const workflow = readFileSync('.github/workflows/test.yml', 'utf8')
    const tag = workflow.match(/mcr\.microsoft\.com\/playwright:v([\d.]+)-noble/)?.[1]
    expect(tag).toBe(playwrightPackage.version)
  })
})
