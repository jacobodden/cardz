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

  const toggleLabel = dark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 sm:py-2 flex items-center justify-between">
          <Link
            to="/"
            aria-label="Cardz home"
            className="-ml-1 w-11 h-11 flex items-center justify-center rounded-lg transition hover:bg-gray-100 dark:hover:bg-gray-800 active:scale-[0.95]"
          >
            <img
              src={`${import.meta.env.BASE_URL}pwa-64x64.png`}
              alt=""
              width={32}
              height={32}
              className="w-8 h-8 rounded-lg"
            />
          </Link>
          <button
            onClick={() => setDark(!dark)}
            data-testid="theme-toggle"
            className="-mr-1 w-11 h-11 flex items-center justify-center rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition active:scale-[0.95]"
            title={toggleLabel}
            aria-label={toggleLabel}
          >
            {dark ? <SunIcon /> : <MoonIcon />}
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <Outlet />
      </main>
    </div>
  )
}

function SunIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
    </svg>
  )
}
