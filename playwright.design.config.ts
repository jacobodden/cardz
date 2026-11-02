import { defineConfig } from '@playwright/test'
import baseConfig from './playwright.config'

/**
 * Manual design-history capture.
 *
 *   npm run design:capture
 *
 * The capture spec writes dated JPEGs and regenerates
 * docs/design-history/index.html. It is intentionally excluded from the
 * normal test run and from CI.
 */
export default defineConfig({
  ...baseConfig,
  testDir: './tests/design-history',
  testIgnore: undefined,
  fullyParallel: false,
  workers: 1,
  projects: [{ name: 'design-history' }],
  reporter: [['list']],
})
