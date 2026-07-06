import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Session } from '../api/client'

export default function HomePage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listSessions().then((sessions) => {
      setSessions(sessions)
      setLoading(false)
    })
  }, [])

  if (loading) return <p className="text-gray-500">Loading...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Game Sessions</h1>
        <Link
          to="/sessions/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm"
        >
          + New Game
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 mb-4">No game sessions yet.</p>
          <Link
            to="/sessions/new"
            className="text-blue-600 hover:text-blue-800 underline"
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
              className="block bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-gray-900">
                  {(s as any).game_name || s.title || `Session #${s.id}`}
                </h2>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {s.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(s.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
