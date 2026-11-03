import { useMemo, useState, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { listSessions, deleteSession } from '../db/sessions'
import type { SessionSummary } from '../db/sessions'
import { getGame } from '../games'
import type { CardFace } from '../games/types'
import FeltHero from '../components/FeltHero'

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

  const activeCount = sessions?.filter((s) => s.status === 'active').length ?? 0
  const finishedCount = (sessions?.length ?? 0) - activeCount
  const summary = [
    activeCount > 0 && `${activeCount} in progress`,
    finishedCount > 0 && `${finishedCount} finished`,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <>
      <FeltHero>
        <div className="flex items-end justify-between gap-4 pt-1 pb-5">
          <div className="min-w-0">
            <h1 className="text-[32px] leading-tight font-extrabold tracking-tight">Games</h1>
            {summary && (
              <p className="mt-0.5 text-sm text-on-felt/85" data-testid="home-summary">
                {summary}
              </p>
            )}
          </div>
          <Link
            to="/sessions/new"
            className="shrink-0 flex items-center gap-1.5 h-11 px-[18px] rounded-full bg-on-felt text-felt text-[15px] font-bold transition hover:opacity-90 active:scale-[0.97]"
          >
            <PlusIcon />
            New game
          </Link>
        </div>
      </FeltHero>

      {!sessions ? (
        <p className="text-muted">Loading...</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted mb-4">No game sessions yet.</p>
          <Link to="/sessions/new" className="text-accent-ink font-semibold underline">
            Start a new game
          </Link>
        </div>
      ) : (
        <>
          {filters.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-5" role="group" aria-label="Filter by game">
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

          <div className="space-y-6">
            {sections.map((section) => (
              <section key={section.key} aria-labelledby={`section-${section.key}`} data-testid="session-section">
                <h2 id={`section-${section.key}`} className="text-[13px] font-bold text-muted mb-2">
                  {section.heading}
                </h2>
                {section.key === 'active' ? (
                  <div className="grid gap-3">
                    {section.sessions.map((s) => (
                      <SessionCard key={s.id} session={s} onDelete={handleDelete} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-line bg-surface overflow-hidden divide-y divide-line">
                    {section.sessions.map((s) => (
                      <SessionCard key={s.id} session={s} onDelete={handleDelete} />
                    ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </>
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
      className={`h-11 px-3.5 rounded-xl border text-sm font-semibold transition active:scale-[0.97] ${
        active ? 'bg-accent border-accent text-on-accent' : 'bg-surface border-line text-ink hover:bg-surface-2'
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

function leaderText(session: SessionSummary): string | null {
  const { standing } = session
  if (!standing) return null
  const verb = standing.names.length > 1 ? 'lead' : 'leads'
  return `${standing.names.join(' & ')} ${verb} · ${standing.total} pts`
}

function roundText(session: SessionSummary): string {
  const total = session.total_rounds
  const current = total ? Math.min(session.rounds_scored + 1, total) : session.rounds_scored + 1
  return total ? `Round ${current} of ${total}` : `Round ${current}`
}

/** First letters, widened to two where players share one (Alice, Andy -> Al, An). */
function initials(names: string[]): string[] {
  const first = names.map((n) => n.trim().charAt(0).toUpperCase())
  return names.map((n, i) =>
    first.filter((f) => f === first[i]).length > 1 ? n.trim().slice(0, 2) : first[i]
  )
}

const AVATAR_TONES = ['bg-avatar-1', 'bg-avatar-2', 'bg-avatar-3']
const MAX_AVATARS = 4

function PlayerAvatars({ names }: { names: string[] }) {
  const letters = initials(names)
  const shown = letters.slice(0, MAX_AVATARS)
  const extra = names.length - shown.length
  return (
    <div role="img" aria-label={`Players: ${names.join(', ')}`} data-testid="session-players" className="flex">
      {shown.map((letter, i) => (
        <span
          key={i}
          className={`-mr-1.5 w-6 h-6 rounded-full border-2 border-surface ${AVATAR_TONES[i % AVATAR_TONES.length]} text-ink text-[11px] font-extrabold flex items-center justify-center`}
        >
          {letter}
        </span>
      ))}
      {extra > 0 && (
        <span className="-mr-1.5 w-6 h-6 rounded-full border-2 border-surface bg-surface-2 text-muted text-[10px] font-bold flex items-center justify-center">
          +{extra}
        </span>
      )}
    </div>
  )
}

const RED_SUITS = new Set(['♥', '♦'])

function CardTile({ face }: { face: CardFace }) {
  const color = RED_SUITS.has(face.suit) ? 'text-card-red' : 'text-card-black'
  return (
    <div
      aria-hidden="true"
      className={`w-10 h-[54px] shrink-0 rounded-md bg-card-face border border-card-edge flex flex-col justify-between px-[5px] py-[3px] font-extrabold ${color}`}
    >
      <span className="text-xs leading-none">{face.rank}</span>
      <span className="text-lg leading-none self-center">{face.suit}</span>
      <span className="text-xs leading-none self-end rotate-180">{face.rank}</span>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  )
}

const SWIPE_OPEN = -96

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
      next = delta < 0 ? SWIPE_OPEN : Math.min(delta + SWIPE_OPEN, 0)
    } else {
      next = delta < 0 ? Math.max(delta, SWIPE_OPEN) : 0
    }
    swipeRef.current = next
    updateTransform(next, false)
  }

  const handleTouchEnd = () => {
    if (swipeRef.current < SWIPE_OPEN / 2) {
      setOpen(true)
      swipeRef.current = SWIPE_OPEN
      updateTransform(SWIPE_OPEN, true)
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

  const active = session.status === 'active'
  // Lead with the custom title; the game name becomes the subtitle.
  const title = session.title || session.game_name || `Session #${session.id}`
  const gameName = session.title ? session.game_name : null
  const face = (session.game_slug && getGame(session.game_slug)?.cardFace) || null

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete(session.id)
  }

  const inlineDelete = (
    <button
      onClick={handleDeleteClick}
      className="hidden sm:flex shrink-0 w-11 h-11 items-center justify-center rounded-lg text-muted hover:text-danger hover:bg-surface-2 transition-colors"
      title="Delete session"
    >
      <TrashIcon />
    </button>
  )

  const subtitle = (extra: string) => (
    <p className="text-[13px] text-muted truncate">
      {gameName && <span data-testid="session-game">{gameName}</span>}
      {gameName && ' · '}
      {extra}
    </p>
  )

  return (
    <div
      className={`relative overflow-hidden ${active ? 'rounded-2xl' : ''}`}
      data-testid="session-card"
      data-session-title={title}
    >
      <div className={`absolute inset-y-0 right-0 flex items-stretch ${active ? 'p-0.5' : ''}`}>
        <button
          onClick={handleDeleteClick}
          className={`bg-danger-solid text-on-danger w-24 flex items-center justify-center hover:opacity-90 active:opacity-80 ${active ? 'rounded-2xl' : ''}`}
          title="Delete session"
        >
          <TrashIcon />
        </button>
      </div>

      <div
        ref={cardRef}
        className={`relative z-10 transition-transform duration-200 ease-out bg-surface ${
          active ? 'rounded-2xl border border-line shadow-sm' : ''
        }`}
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
          className={
            active
              ? 'flex items-center gap-3 p-3 rounded-2xl transition active:bg-surface-2'
              : 'flex items-center gap-3 min-h-14 px-3.5 py-2 transition active:bg-surface-2'
          }
        >
          {active ? (
            <>
              {face && <CardTile face={face} />}
              <div className="flex-1 min-w-0">
                <h3 className="text-[17px] font-bold truncate">{title}</h3>
                {subtitle(roundText(session))}
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  {session.players.length > 0 && <PlayerAvatars names={session.players} />}
                  {session.standing && (
                    <span className="text-[13px] font-bold text-accent-ink truncate" data-testid="session-standing">
                      {leaderText(session)}
                    </span>
                  )}
                </div>
              </div>
              {inlineDelete}
            </>
          ) : (
            <>
              <div className="flex-1 min-w-0">
                <h3 className="text-[15px] font-semibold truncate">{title}</h3>
                {subtitle(formatDate(session.created_at))}
              </div>
              {session.standing && (
                <span
                  className="shrink-0 max-w-[45%] truncate text-[13px] font-bold px-2.5 py-1 rounded-full bg-win-bg text-win-fg"
                  data-testid="session-standing"
                >
                  <span className="sr-only">Winner: </span>
                  {session.standing.names.join(' & ')} · {session.standing.total}
                </span>
              )}
              {inlineDelete}
            </>
          )}
        </Link>
      </div>
    </div>
  )
}
