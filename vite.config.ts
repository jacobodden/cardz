import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import type { Plugin } from 'vite'
import { DEFAULT_THEME_ID, THEME_STORAGE_KEY, themeColorMap } from './src/themes.ts'

/** Gives index.html's startup script the theme registry (see src/themes.ts). */
function injectThemes(): Plugin {
  const themes = { defaultId: DEFAULT_THEME_ID, storageKey: THEME_STORAGE_KEY, colors: themeColorMap() }
  return {
    name: 'cardz-inject-themes',
    transformIndexHtml(html) {
      if (!html.includes('__THEMES__')) throw new Error('index.html is missing the __THEMES__ placeholder')
      return html.replace('__THEMES__', JSON.stringify(themes))
    },
  }
}

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/cardz/' : '/',
  plugins: [
    react(),
    injectThemes(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Cardz',
        short_name: 'Cardz',
        description: 'Card game score tracker',
        theme_color: '#1e6b4e',
        background_color: '#eef3ef',
        display: 'standalone',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        cleanupOutdatedCaches: true,
      },
      // Playwright runs the dev server; keep the service worker out of tests so
      // assets are never served from a previous run's cache.
      devOptions: { enabled: !process.env.PLAYWRIGHT },
    }),
  ],
})
