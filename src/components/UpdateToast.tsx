import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CHANGELOG, SEEN_UPDATE_KEY, updateToAnnounce } from '../changelog'

/** How long the toast stays up unless the player closes it or opens What's new. */
const SHOW_MS = 12_000

function readSeen(): string | null {
  try {
    return localStorage.getItem(SEEN_UPDATE_KEY)
  } catch {
    return null
  }
}

/**
 * "Cardz updated" once after the app updates to a build with a new
 * changelog entry (see src/changelog.ts), linking to What's new.
 */
export default function UpdateToast() {
  const [entry, setEntry] = useState(() => updateToAnnounce(readSeen()))

  // Saved straight away, so the toast shows once whether or not it's tapped.
  useEffect(() => {
    const latest = CHANGELOG[0]
    if (!latest) return
    try {
      localStorage.setItem(SEEN_UPDATE_KEY, latest.id)
    } catch {
      // No storage (private mode): the toast may show again next launch.
    }
  }, [])

  useEffect(() => {
    if (!entry) return
    const timer = setTimeout(() => setEntry(null), SHOW_MS)
    return () => clearTimeout(timer)
  }, [entry])

  if (!entry) return null

  return (
    <div
      role="status"
      data-testid="update-toast"
      className="fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-line-strong bg-surface py-3 pr-2 pl-4 shadow-lg"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">Cardz updated</p>
        <p className="line-clamp-2 text-sm text-muted">{entry.title}</p>
      </div>
      <Link
        to="/changelog"
        onClick={() => setEntry(null)}
        className="shrink-0 rounded-full bg-action px-3.5 py-2 text-sm font-bold text-on-action transition hover:opacity-90 active:scale-[0.97]"
      >
        What's new
      </Link>
      <button
        type="button"
        onClick={() => setEntry(null)}
        aria-label="Dismiss"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-surface-2"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  )
}
