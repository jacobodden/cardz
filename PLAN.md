# Phase 0 — Flatten Directory Structure

Move everything from `client/` up to repo root (no more server/client distinction).

## Steps

1. Move files up:
   ```
   client/src/         → src/
   client/public/      → public/
   client/index.html   → index.html
   client/package.json → package.json  (replaces root proxy package.json)
   client/package-lock.json → package-lock.json
   client/vite.config.ts    → vite.config.ts
   client/tsconfig.json     → tsconfig.json
   client/tsconfig.app.json → tsconfig.app.json
   client/tsconfig.node.json → tsconfig.node.json
   client/.oxlintrc.json   → .oxlintrc.json
   client/README.md        → README.md
   ```

2. Merge `.gitignore` — combine root + client contents

3. Delete `client/` directory

4. Reinstall deps at root (`npm install`)

5. Verify `npm run build` passes

6. Update `AGENTS.md` — change all `client/src/` to `src/`, remove `client/` prefixes

---

# Phase 1 — PWA via `vite-plugin-pwa`

## 1.1 Install dependencies

```bash
npm install -D vite-plugin-pwa workbox-window
```

## 1.2 Add TypeScript types

In `tsconfig.app.json`, change:
```json
"types": ["vite/client"]
```
to:
```json
"types": ["vite/client", "vite-plugin-pwa/react"]
```

## 1.3 Configure PWA Assets Generator

Create `pwa-assets.config.ts`:
```ts
import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: minimal2023Preset,
  images: ['public/pwa-icon.png'],
})
```

Add script to `package.json`:
```json
"generate-pwa-assets": "pwa-assets-generator"
```

Usage: place `public/pwa-icon.png`, then run `npm run generate-pwa-assets`.

Output files: `pwa-64x64.png`, `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png`, `favicon.ico`.

## 1.4 Update vite.config.ts

```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/cardz/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons.svg'],
      manifest: {
        name: 'Cardz',
        short_name: 'Cardz',
        description: 'Card game score tracker',
        theme_color: '#863bff',
        background_color: '#ffffff',
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
      devOptions: { enabled: true },
    }),
  ],
})
```

## 1.5 Create ReloadPrompt component

File: `src/components/ReloadPrompt.tsx`

```tsx
import { useRegisterSW } from 'virtual:pwa-register/react'

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW registered:', r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  if (!offlineReady && !needRefresh) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-lg border border-gray-300 bg-white p-4 shadow-lg dark:border-gray-600 dark:bg-gray-800">
      <p className="mb-2 text-sm text-gray-700 dark:text-gray-200">
        {offlineReady
          ? 'App ready to work offline'
          : 'New content available, click reload to update.'}
      </p>
      <div className="flex gap-2">
        {needRefresh && (
          <button
            onClick={() => updateServiceWorker(true)}
            className="rounded bg-[#863bff] px-3 py-1 text-sm text-white hover:bg-[#6f2ed6]"
          >
            Reload
          </button>
        )}
        <button
          onClick={close}
          className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Close
        </button>
      </div>
    </div>
  )
}

export default ReloadPrompt
```

## 1.6 Add ReloadPrompt to App.tsx

```tsx
import { BrowserRouter, Routes, Route, useNavigate, useEffect } from 'react-router-dom'
import Layout from './components/Layout'
import ReloadPrompt from './components/ReloadPrompt'
import HomePage from './pages/HomePage'
import NewSessionPage from './pages/NewSessionPage'
import SessionPage from './pages/SessionPage'

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <InnerApp />
    </BrowserRouter>
  )
}

function InnerApp() {
  const navigate = useNavigate()

  useEffect(() => {
    const redirect = sessionStorage.getItem('redirect')
    if (redirect) {
      sessionStorage.removeItem('redirect')
      const base = import.meta.env.BASE_URL
      const path = redirect.startsWith(base)
        ? redirect.slice(base.length - 1)
        : redirect
      navigate(path)
    }
  }, [navigate])

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/sessions/new" element={<NewSessionPage />} />
          <Route path="/sessions/:id" element={<SessionPage />} />
        </Route>
      </Routes>
      <ReloadPrompt />
    </>
  )
}

export default App
```

Note: `useNavigate` and `useEffect` need to be imported from `react-router-dom` and `react` respectively.

## 1.7 Update index.html

Add inside `<head>`:
```html
<meta name="theme-color" content="#863bff" />
```

---

# Phase 2 — GitHub Pages

## 2.1 Set base in vite.config.ts

Already handled in 1.4 above — `base` is set conditionally:
```ts
base: process.env.NODE_ENV === 'production' ? '/cardz/' : '/',
```

## 2.2 SPA routing fix

### 2.2.1 Create public/404.html

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Redirecting...</title>
  <script>
    sessionStorage.setItem('redirect', location.pathname + location.search + location.hash)
    location.replace('/cardz/')
  </script>
</head>
<body></body>
</html>
```

### 2.2.2 BrowserRouter basename

Already handled in 1.6 — `basename={import.meta.env.BASE_URL}` is set on `<BrowserRouter>`.

### 2.2.3 Redirect handler

Already handled in 1.6 — `InnerApp` has a `useEffect` that reads `sessionStorage.redirect` and navigates.

## 2.3 Create GitHub Actions workflow

File: `.github/workflows/deploy.yml`

```yaml
# Simple workflow for deploying static content to GitHub Pages
name: Deploy static content to Pages

on:
  # Runs on pushes targeting the default branch
  push:
    branches: ['main']

  # Allows you to run this workflow manually from the Actions tab
  workflow_dispatch:

# Sets the GITHUB_TOKEN permissions to allow deployment to GitHub Pages
permissions:
  contents: read
  pages: write
  id-token: write

# Allow one concurrent deployment
concurrency:
  group: 'pages'
  cancel-in-progress: true

jobs:
  # Single deploy job since we're just deploying
  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      - name: Set up Node
        uses: actions/setup-node@v4
        with:
          node-version: lts/*
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Build
        run: npm run build
      - name: Setup Pages
        uses: actions/configure-pages@v4
      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

---

# Post-implementation checklist

- [ ] Phase 0: Files moved, `client/` deleted, build passes
- [ ] Phase 1: Dependencies installed
- [ ] Phase 1: TS types updated (`tsconfig.app.json`)
- [ ] Phase 1: Assets generator config + script in `package.json`
- [ ] Phase 1: `vite.config.ts` updated with `VitePWA()`
- [ ] Phase 1: `ReloadPrompt.tsx` created
- [ ] Phase 1: `App.tsx` updated with basename, redirect handler, ReloadPrompt
- [ ] Phase 1: `index.html` has theme-color meta tag
- [ ] Phase 2: `public/404.html` created
- [ ] Phase 2: `.github/workflows/deploy.yml` created
- [ ] Verify: `npm run build` succeeds
- [ ] Verify: `npm run dev` starts without errors
- [ ] User creates GitHub repo `jacobodden/cardz`
- [ ] User pushes `main` branch
- [ ] User enables GitHub Pages (Settings → Pages → Source → GitHub Actions)
- [ ] User provides PWA source image (`public/pwa-icon.png`)
- [ ] User runs `npm run generate-pwa-assets` to produce icon files
- [ ] User commits generated icons and pushes
