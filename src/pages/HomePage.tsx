import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { listSessions, deleteSession } from '../db/sessions'
import type { SessionSummary } from '../db/sessions'

export default function HomePage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listSessions().then((sessions) => {
      setSessions(sessions)
      setLoading(false)
    })
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this game session? This cannot be undone.')) return
    await deleteSession(id)
    setSessions((prev) => prev.filter((s) => s.id !== id))
  }

  if (loading) return <p className="text-gray-500 dark:text-gray-400">Loading...</p>

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
        <div className="grid gap-4">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onDelete(session.id)
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="absolute inset-y-0 right-0 flex items-center">
        <button
          onClick={handleDeleteClick}
          className="bg-red-600 text-white w-24 h-full rounded-lg flex items-center justify-center gap-1 text-sm font-medium hover:bg-red-700 active:bg-red-800"
        >
          <TrashIcon />
          Delete
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
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">
              {session.game_name || session.title || `Session #${session.id}`}
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDeleteClick}
                className="hidden sm:flex text-gray-400 hover:text-red-600 dark:hover:text-red-400 p-1 rounded transition-colors"
                title="Delete session"
              >
                <TrashIcon />
              </button>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  session.status === 'active'
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}
              >
                {session.status}
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {new Date(session.created_at).toLocaleDateString()}
          </p>
        </Link>
      </div>
    </div>
  )
}
