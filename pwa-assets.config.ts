import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Felt green, from --felt in src/index.css. Fills the padding around the
// maskable and Apple icons so it matches the icon's own background.
const FELT = '#1E6B4E'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    transparent: {
      sizes: [64, 192, 512],
      favicons: [
        [48, 'favicon-48x48.ico'],
        [64, 'favicon.ico'],
      ],
    },
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: FELT },
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: FELT },
    },
  },
  images: ['public/pwa-icon.png'],
})
