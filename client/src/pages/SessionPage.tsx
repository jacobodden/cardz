import { useCallback, useEffect, useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../api/client'
import type { Session, CurrentRound, ScoreboardRow, InputField, ScoreDataValue, RoundMetaInfo } from '../api/client'

const SUIT_COLORS: Record<string, string> = {
  '♠': 'text-gray-900',
  '♥': 'text-red-600',
  '♣': 'text-gray-900',
  '♦': 'text-red-600',
}

function findWinners(rows: ScoreboardRow[], gameSlug?: string): Set<number> {
  if (rows.length === 0) return new Set()
  const totals = rows.map((r) => r.total)
  const target = gameSlug === 'pay-me' ? Math.min(...totals) : Math.max(...totals)
  return new Set(rows.filter((r) => r.total === target).map((r) => r.player_id))
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const sessionId = Number(id)
  const [session, setSession] = useState<Session | null>(null)
  const [round, setRound] = useState<CurrentRound | null>(null)
  const [players, setPlayersState] = useState<ScoreboardRow[]>([])
  const [roundsMeta, setRoundsMeta] = useState<RoundMetaInfo[]>([])
  const [roundData, setRoundData] = useState<Record<string, ScoreDataValue>>({})
  const [playerData, setPlayerData] = useState<Record<number, Record<string, ScoreDataValue>>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [s, sb] = await Promise.all([
      api.getSession(sessionId),
      api.getScoreboard(sessionId),
    ])
    setSession(s)
    setPlayersState(sb.players)
    setRoundsMeta(sb.rounds_meta)

    try {
      const r = await api.getCurrentRound(sessionId)
      setRound(r)
    } catch {
      setRound(null)
    }
  }, [sessionId])

  useEffect(() => {
    load()
  }, [load])

  async function handleSubmit() {
    if (!round) return
    setSubmitting(true)
    setError(null)

    try {
      const roundScopeFields = round.fields?.filter((f) => f.scope === 'round') ?? []
      const round_data: Record<string, any> = {}
      for (const f of roundScopeFields) {
        if (roundData[f.key] !== undefined) round_data[f.key] = roundData[f.key]
      }

      const playerScopeFields = round.fields?.filter((f) => f.scope !== 'round') ?? []
      const scores = (session?.players ?? []).map((p) => {
        const data: Record<string, ScoreDataValue> = {}
        for (const f of playerScopeFields) {
          if (playerData[p.id]?.[f.key] !== undefined) data[f.key] = playerData[p.id][f.key]
        }
        return { player_id: p.id, data }
      })

      await api.submitRound(sessionId, { round_data, scores })

      setRoundData({})
      setPlayerData({})
      await load()
    } catch (err: any) {
      setError(err.message)
    }

    setSubmitting(false)
  }

  const winners = useMemo(
    () => findWinners(players, session?.game?.slug),
    [players, session?.game?.slug]
  )

  const playerMap = useMemo(() => {
    const map: Record<number, string> = {}
    for (const p of session?.players ?? []) {
      map[p.id] = p.name
    }
    return map
  }, [session?.players])

  function getTrumpForRound(roundNum: number): string | null {
    const meta = roundsMeta.find((r) => r.round_number === roundNum)
    if (!meta) return null
    try {
      const data = JSON.parse(meta.data_json)
      return data.trump ?? null
    } catch {
      return null
    }
  }

  function getDealerForRound(roundNum: number): string | null {
    const meta = roundsMeta.find((r) => r.round_number === roundNum)
    if (!meta) return null
    try {
      const data = JSON.parse(meta.data_json)
      return data.dealer_player_id ? (playerMap[data.dealer_player_id] ?? null) : null
    } catch {
      return null
    }
  }

  if (!session) return <p className="text-gray-500">Loading...</p>

  const sessionPlayers = session.players ?? []
  const roundFields = round?.fields?.filter((f) => f.scope === 'round') ?? []
  const playerFields = round?.fields?.filter((f) => f.scope !== 'round') ?? []
  const isComplete = round?.complete || session.status === 'completed'
  const totalRounds = session.total_rounds ?? 0

  const rawRoundData: Record<string, any> = round?.data_json
    ? (() => { try { return JSON.parse(round.data_json) } catch { return {} } })()
    : {}
  const handSize: number = rawRoundData.handSize ?? 0

  const hasBidField = playerFields.some((f) => f.key === 'bid')
  const totalBids = hasBidField
    ? sessionPlayers.reduce((sum, p) => sum + (Number(playerData[p.id]?.bid) || 0), 0)
    : 0
  const hookRuleViolated = hasBidField && handSize > 0 && totalBids === handSize

  const currentDealer = round && !isComplete
    ? getDealerForRound(round.round_number)
    : null
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        {session.title || session.game?.name || 'Game'}
      </h1>
      {session.game && (
        <p className="text-sm text-gray-500 mb-6">{session.game.name}</p>
      )}

      {/* Scoreboard */}
      <section className="mb-8 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 border-b border-gray-200 font-medium text-gray-700">
                Player
              </th>
              {totalRounds > 0 && Array.from({ length: totalRounds }, (_, i) => {
                const roundNum = i + 1
                const trump = getTrumpForRound(roundNum)
                const dealer = getDealerForRound(roundNum)
                return (
                  <th
                    key={i}
                    className="text-center p-2 border-b border-gray-200 font-medium text-gray-700 w-16"
                  >
                    <div className="text-xs">R{roundNum}</div>
                    {trump && (
                      <div className={`text-base leading-tight ${SUIT_COLORS[trump] ?? 'text-gray-500'}`}>
                        {trump}
                      </div>
                    )}
                    {dealer && (
                      <div className="text-[10px] text-gray-400 leading-tight mt-0.5">{dealer}</div>
                    )}
                  </th>
                )
              })}
              <th className="text-center p-2 border-b border-gray-200 font-medium text-gray-700 w-12">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((row) => {
              const isWinner = winners.has(row.player_id)
              return (
                <tr
                  key={row.player_id}
                  className={`hover:bg-gray-50 ${isWinner && isComplete ? 'bg-yellow-50' : ''}`}
                >
                  <td className="p-2 border-b border-gray-100 text-gray-900 font-medium">
                    <span className="flex items-center gap-1">
                      {row.name}
                      {isWinner && isComplete && (
                        <span className="text-yellow-500 text-sm" title="Winner">
                          👑
                        </span>
                      )}
                    </span>
                  </td>
                  {row.scores.map((s, i) => (
                    <td
                      key={i}
                      className={`text-center p-2 border-b border-gray-100 ${
                        s !== null ? 'text-gray-900' : 'text-gray-300'
                      }`}
                    >
                      {s !== null ? s : '-'}
                    </td>
                  ))}
                  <td className={`text-center p-2 border-b border-gray-100 font-bold ${
                    isWinner && isComplete ? 'text-yellow-700' : 'text-gray-900'
                  }`}>
                    {row.total}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      {/* Current round input */}
      {!isComplete && round && !round.complete && (
        <section className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-baseline gap-3 mb-1">
            <h2 className="font-semibold text-gray-900">
              Round {round.round_number}
            </h2>
            {currentDealer && (
              <span className="text-xs text-gray-400">Dealer: {currentDealer}</span>
            )}
          </div>
          {handSize > 0 && (
            <p className="text-sm text-gray-500 mb-4">{handSize} cards</p>
          )}

          {roundFields.length > 0 && (
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-500 uppercase mb-2">Round Settings</p>
              <div className="flex items-center gap-3 flex-wrap">
                {roundFields.map((f) => (
                  <RoundFieldInput
                    key={f.key}
                    field={f}
                    value={roundData[f.key]}
                    onChange={(v) => setRoundData((prev) => ({ ...prev, [f.key]: v }))}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {sessionPlayers.map((p) => (
              <div key={p.id} className="flex items-center gap-3 flex-wrap">
                <span className="text-sm font-medium text-gray-700 w-24">{p.name}</span>
                {playerFields.map((f) => (
                  <PlayerFieldInput
                    key={f.key}
                    field={f}
                    value={playerData[p.id]?.[f.key]}
                    onChange={(v) =>
                      setPlayerData((prev) => ({
                        ...prev,
                        [p.id]: { ...prev[p.id], [f.key]: v },
                      }))
                    }
                  />
                ))}
              </div>
            ))}
          </div>

          {hookRuleViolated && (
            <p className="text-red-600 text-sm mt-2">
              Hook rule: total bids ({totalBids}) cannot equal hand size ({handSize}). Someone must fail.
            </p>
          )}
          {error && <p className="text-red-600 text-sm mt-2">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting || hookRuleViolated}
            className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {submitting ? 'Saving...' : 'Submit Round'}
          </button>
        </section>
      )}

      {isComplete && (
        <div className="text-center py-6">
          <p className="text-green-600 font-bold text-lg">Game Complete!</p>
          <p className="text-gray-500 text-sm mt-1">
            {session.game?.slug === 'pay-me' ? 'Lowest score wins' : 'Highest score wins'}
          </p>
        </div>
      )}
    </div>
  )
}

function RoundFieldInput({
  field,
  value,
  onChange,
}: {
  field: InputField
  value: ScoreDataValue | undefined
  onChange: (v: ScoreDataValue) => void
}) {
  if (field.type === 'select' && field.options) {
    return (
      <label className="text-sm text-gray-500">
        {field.label}
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="ml-2 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="" disabled>
            Select...
          </option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return (
    <label className="text-sm text-gray-500">
      {field.label}
      <input
        type="number"
        min={field.min}
        max={field.max}
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ml-2 border border-gray-300 rounded px-2 py-1 w-20 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  )
}

function PlayerFieldInput({
  field,
  value,
  onChange,
}: {
  field: InputField
  value: ScoreDataValue | undefined
  onChange: (v: ScoreDataValue) => void
}) {
  if (field.type === 'number') {
    return (
      <label className="text-sm text-gray-500">
        {field.label}
        <input
          type="number"
          min={field.min}
          max={field.max}
          value={value ?? ''}
          onChange={(e) => onChange(Number(e.target.value))}
          className="ml-1 border border-gray-300 rounded px-2 py-1 w-16 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </label>
    )
  }

  if (field.type === 'select' && field.options) {
    return (
      <label className="text-sm text-gray-500">
        {field.label}
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className="ml-1 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="" disabled>
            Select...
          </option>
          {field.options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      </label>
    )
  }

  return null
}
