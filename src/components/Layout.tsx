import { useEffect, useMemo, useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { HeroSlotContext } from './heroSlot'
import ThemePicker from './ThemePicker'
import { ThemeContext } from './themeContext'
import { DEFAULT_LOGO, THEME_STORAGE_KEY, getTheme } from '../themes'

function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export default function Layout() {
  const [dark, setDark] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('theme')
      if (stored) return stored === 'dark'
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })

  // index.html's startup script has already applied this before first paint.
  const [palette, setPalette] = useState(() => getTheme(readStorage(THEME_STORAGE_KEY)).id)

  const [heroTarget, setHeroTarget] = useState<HTMLElement | null>(null)
  const [actionsTarget, setActionsTarget] = useState<HTMLElement | null>(null)
  const [footerTarget, setFooterTarget] = useState<HTMLElement | null>(null)
  const [felt, setFelt] = useState(false)
  // The header is always felt, so its buttons always use the on-felt colors.
  const iconButton =
    'w-11 h-11 flex items-center justify-center rounded-lg transition active:scale-[0.95] disabled:opacity-50 text-on-felt hover:bg-on-felt/10'
  const heroSlot = useMemo(
    () => ({ target: heroTarget, actions: actionsTarget, footer: footerTarget, iconButton, setFelt }),
    [heroTarget, actionsTarget, footerTarget]
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, palette)
    } catch {
      // Private mode or blocked storage: the choice just won't persist.
    }
  }, [palette])

  useEffect(() => {
    // Match the browser chrome (and the installed app's status bar) to the felt header.
    const meta = document.querySelector('meta[name="theme-color"]')
    const color = getComputedStyle(document.documentElement).getPropertyValue('--felt').trim()
    if (meta && color) meta.setAttribute('content', color)
  }, [dark, palette])

  const theme = getTheme(palette)
  const toggleLabel = dark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <ThemeContext.Provider value={theme}>
      <HeroSlotContext.Provider value={heroSlot}>
        <div className="flex min-h-dvh flex-col bg-page text-ink">
          {/*
            Pinned felt header. It extends up under the iOS status bar
            (black-translucent, see index.html), so the bar shows the theme's
            felt with no seam, and scrolled content never sits behind the clock.
          */}
          <div className={`sticky top-0 z-30 bg-felt text-on-felt pt-[env(safe-area-inset-top)] ${felt ? '' : 'shadow-[0_4px_0_var(--band-stripe)]'}`}>
            <header className="safe-x max-w-7xl mx-auto py-1.5 sm:py-2 flex items-center justify-between">
              <Link
                to="/"
                aria-label="Cardz home"
                className={`-ml-1 ${iconButton}`}
              >
                <img
                  src={`${import.meta.env.BASE_URL}${theme.logo ?? DEFAULT_LOGO}`}
                  data-testid="app-logo"
                  alt=""
                  width={32}
                  height={32}
                  className="w-8 h-8 drop-shadow-sm"
                />
              </Link>
              <div className="-mr-1 flex items-center gap-1">
                {/* Pages add icon buttons here (see HeaderActions). */}
                <div ref={setActionsTarget} className="contents" />
                <ThemePicker value={palette} onChange={setPalette} buttonClass={iconButton} />
                <button
                  onClick={() => setDark(!dark)}
                  data-testid="theme-toggle"
                  className={iconButton}
                  title={toggleLabel}
                  aria-label={toggleLabel}
                >
                  {dark ? <SunIcon /> : <MoonIcon />}
                </button>
              </div>
            </header>
          </div>
          <div
            data-testid="app-bar"
            data-felt={felt || undefined}
            className={felt ? 'bg-felt text-on-felt rounded-b-[28px] shadow-[0_4px_0_var(--band-stripe)]' : undefined}
          >
            {/* Pages render their hero (see FeltHero) here, in the felt band under the header. */}
            <div ref={setHeroTarget} className="safe-x max-w-7xl mx-auto" />
          </div>
          <main className="safe-x max-w-7xl mx-auto w-full flex-1 py-4 sm:py-6">
            <Outlet />
          </main>
          {/* A bar stuck to the bottom of the screen that pages fill (see
              PageFooter); content scrolls behind it. Hidden when unused. */}
          <footer
            ref={setFooterTarget}
            className="safe-x sticky bottom-0 z-20 w-full border-t border-line bg-page/90 pb-[env(safe-area-inset-bottom)] text-center backdrop-blur-md empty:hidden"
          />
        </div>
      </HeroSlotContext.Provider>
    </ThemeContext.Provider>
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
