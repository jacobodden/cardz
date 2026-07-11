import { useEffect, useState } from 'react'
import { Outlet, Link } from 'react-router-dom'

const THEME_COLOR_LIGHT = '#863bff'
const THEME_COLOR_DARK = '#111827'

export default function Layout() {
  const [dark, setDark] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('theme')
      if (stored) return stored === 'dark'
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? THEME_COLOR_DARK : THEME_COLOR_LIGHT)
  }, [dark])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Cardz
          </Link>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setDark(!dark)}
              className="text-lg w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {dark ? '\u2600' : '\u263E'}
            </button>
            <Link
              to="/sessions/new"
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              + New Game
            </Link>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Outlet />
      </main>
    </div>
  )
}
