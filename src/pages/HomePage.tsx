import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listSessions } from '../db/sessions'
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
            <Link
              key={s.id}
              to={`/sessions/${s.id}`}
              className="block bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 sm:p-5 hover:shadow-md transition active:bg-gray-50 dark:active:bg-gray-800"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">
                  {s.game_name || s.title || `Session #${s.id}`}
                </h2>
                <span className={`text-xs px-2 py-1 rounded-full ${
                    s.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {s.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {new Date(s.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
