import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: { ...minimal2023Preset, ...{
   transparent: {
     sizes: [64, 192, 512 ],
     favicons: [
       [48, 'favicon-48x48.ico'],
       [64, 'favicon.ico'],
     ],
   }
  }},
  images: ['public/pwa-icon.png'],
})
