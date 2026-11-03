import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts so unit tests don't load the PWA/React plugins.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/unit/setup.ts'],
  },
})
