import { useMemo, useState, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { listSessions, deleteSession } from '../db/sessions'
import type { SessionSummary } from '../db/sessions'

interface Section {
  key: string
  heading: string
  sessions: SessionSummary[]
}

/** Active games first, then finished games grouped by the month they started. */
function groupSessions(sessions: SessionSummary[]): Section[] {
  const sections: Section[] = []
  const active = sessions.filter((s) => s.status === 'active')
  if (active.length > 0) {
    sections.push({ key: 'active', heading: 'In progress', sessions: active })
  }

  // `sessions` is newest first, so months come out newest first too.
  const months = new Map<string, Section>()
  for (const s of sessions) {
    if (s.status === 'active') continue
    const date = new Date(s.created_at)
    const key = `${date.getFullYear()}-${date.getMonth()}`
    let section = months.get(key)
    if (!section) {
      section = {
        key,
        heading: date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }),
        sessions: [],
      }
      months.set(key, section)
      sections.push(section)
    }
    section.sessions.push(s)
  }
  return sections
}

/** One chip per game that has at least one session, in name order. */
function gameFilters(sessions: SessionSummary[]): { slug: string; name: string }[] {
  const games = new Map<string, string>()
  for (const s of sessions) {
    if (s.game_slug) games.set(s.game_slug, s.game_name ?? s.game_slug)
  }
  return [...games].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name))
}

export default function HomePage() {
  const sessions = useLiveQuery(listSessions, [])
  // Kept in the URL so the filter survives opening a game and coming back.
  const [searchParams, setSearchParams] = useSearchParams()

  const filters = useMemo(() => gameFilters(sessions ?? []), [sessions])
  // Ignore a filter for a game with no sessions left (e.g. after deleting).
  const requested = searchParams.get('game')
  const selected = filters.some((f) => f.slug === requested) ? requested : null

  const sections = useMemo(
    () => groupSessions((sessions ?? []).filter((s) => !selected || s.game_slug === selected)),
    [sessions, selected],
  )

  const selectGame = (slug: string | null) => {
    setSearchParams(slug ? { game: slug } : {}, { replace: true })
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this game session? This cannot be undone.')) return
    await deleteSession(id)
  }

  if (!sessions) return <p className="text-gray-500 dark:text-gray-400">Loading...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Game Sessions</h1>
        <Link
          to="/sessions/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 text-sm"
        >
          + New Game
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No game sessions yet.</p>
          <Link
            to="/sessions/new"
            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
          >
            Start a new game
          </Link>
        </div>
      ) : (
        <>
          {filters.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filter by game">
              <FilterChip label="All" active={selected === null} onClick={() => selectGame(null)} />
              {filters.map((f) => (
                <FilterChip
                  key={f.slug}
                  label={f.name}
                  slug={f.slug}
                  active={selected === f.slug}
                  onClick={() => selectGame(f.slug)}
                />
              ))}
            </div>
          )}

          <div className="space-y-8">
            {sections.map((section) => (
              <section key={section.key} aria-labelledby={`section-${section.key}`} data-testid="session-section">
                <h2
                  id={`section-${section.key}`}
                  className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3"
                >
                  {section.heading}
                </h2>
                <div className="grid gap-4">
                  {section.sessions.map((s) => (
                    <SessionCard key={s.id} session={s} onDelete={handleDelete} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function FilterChip({
  label,
  slug,
  active,
  onClick,
}: {
  label: string
  slug?: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      data-testid="game-filter"
      data-game-slug={slug ?? ''}
      className={`text-sm px-3 py-1.5 rounded-full border transition ${
        active
          ? 'bg-blue-600 border-blue-600 text-white'
          : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-100 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800'
      }`}
    >
      {label}
    </button>
  )
}

function formatDate(iso: string): string {
  const date = new Date(iso)
  const sameYear = date.getFullYear() === new Date().getFullYear()
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
  })
}

function standingText(session: SessionSummary): string | null {
  const { standing } = session
  if (!standing) return null
  const names = standing.names.join(' & ')
  const tie = standing.names.length > 1
  const verb = session.status === 'active' ? (tie ? 'lead' : 'leads') : tie ? 'tie' : 'wins'
  return `${names} ${verb} · ${standing.total} pts`
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

function SessionCard({ session, onDelete }: { session: SessionSummary; onDelete: (id: number) => void }) {
  const [open, setOpen] = useState(false)
  const swipeRef = useRef(0)
  const touchStartRef = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)

  const updateTransform = (x: number, smooth: boolean) => {
    if (cardRef.current) {
      cardRef.current.style.transition = smooth ? '' : 'none'
      cardRef.current.style.transform = `translateX(${x}px)`
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    const delta = e.touches[0].clientX - touchStartRef.current
    let next: number
    if (open) {
      next = delta < 0 ? -96 : Math.min(delta - 96, 0)
    } else {
      next = delta < 0 ? Math.max(delta, -96) : 0
    }
    swipeRef.current = next
    updateTransform(next, false)
  }

  const handleTouchEnd = () => {
    if (swipeRef.current < -48) {
      setOpen(true)
      swipeRef.current = -96
      updateTransform(-96, true)
    } else {
      setOpen(false)
      swipeRef.current = 0
      updateTransform(0, true)
    }
  }

  const closeSwipe = () => {
    setOpen(false)
    swipeRef.current = 0
    updateTransform(0, true)
  }

  // Lead with the custom title; the game name becomes the subtitle.
  const title = session.title || session.game_name || `Session #${session.id}`
  const subtitle = session.title ? session.game_name : null
  const standing = standingText(session)

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete(session.id)
  }

  return (
    <div className="relative overflow-hidden rounded-lg" data-testid="session-card" data-session-title={title}>
      <div className="absolute inset-y-0 right-0.5 flex items-center">
        <button
          onClick={handleDeleteClick}
          className="bg-red-600 text-white w-22 h-95/100 rounded-lg flex items-center justify-center hover:bg-red-700 active:bg-red-800"
          title="Delete session"
        >
          <TrashIcon />
        </button>
      </div>

      <div
        ref={cardRef}
        className="relative z-10 transition-transform duration-200 ease-out bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <Link
          to={`/sessions/${session.id}`}
          onClick={(e) => {
            if (open) {
              e.preventDefault()
              closeSwipe()
            }
          }}
          className="block p-4 sm:p-5 hover:shadow-md transition active:bg-gray-50 dark:active:bg-gray-800 rounded-lg"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{title}</h3>
              {subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate" data-testid="session-game">
                  {subtitle}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleDeleteClick}
                className="hidden sm:flex text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-0.5 rounded transition-colors"
                title="Delete session"
              >
                <TrashIcon />
              </button>
              <span className="text-xs text-gray-500 dark:text-gray-400">{formatDate(session.created_at)}</span>
            </div>
          </div>
          {session.players.length > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 truncate" data-testid="session-players">
              {session.players.join(', ')}
            </p>
          )}
          {standing && (
            <p
              className={`text-sm mt-1 font-medium ${
                session.status === 'active'
                  ? 'text-green-700 dark:text-green-400'
                  : 'text-amber-700 dark:text-amber-400'
              }`}
              data-testid="session-standing"
            >
              {session.status === 'active' ? '' : '🏆 '}
              {standing}
            </p>
          )}
        </Link>
      </div>
    </div>
  )
}
