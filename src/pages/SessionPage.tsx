import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { finishSession, getSession } from '../db/sessions'
import {
  getCurrentRound,
  getScoreboard,
  submitRound,
  undoLastRound,
} from '../db/rounds'
import type { RoundMetaInfo, ScoreboardRow } from '../db/rounds'
import { getGame } from '../games'
import type { InputField, PlayerScoreInput, ScoreDirection } from '../games/types'

const SUIT_SYMBOLS = new Set(['♠', '♥', '♣', '♦'])

const SUIT_COLORS: Record<string, string> = {
  '♠': 'text-gray-900 dark:text-gray-100',
  '♥': 'text-red-600 dark:text-red-400',
  '♣': 'text-gray-900 dark:text-gray-100',
  '♦': 'text-red-600 dark:text-red-400',
}

type FieldValue = string | number | boolean

function coerce(field: InputField, raw: FieldValue | undefined) {
  if (raw === undefined || raw === '') return undefined
  return field.type === 'number' ? Number(raw) : raw
}

/** Round-scope inputs as the game expects them (empty values dropped). */
function collectRoundData(
  fields: InputField[] | undefined,
  values: Record<string, FieldValue>
): Record<string, any> {
  const data: Record<string, any> = {}
  for (const f of fields ?? []) {
    if (f.scope !== 'round') continue
    const value = coerce(f, values[f.key])
    if (value !== undefined) data[f.key] = value
  }
  return data
}

/** Per-player inputs as the game expects them (empty values dropped). */
function collectScores(
  fields: InputField[] | undefined,
  players: ScoreboardRow[],
  values: Record<number, Record<string, FieldValue>>
): PlayerScoreInput[] {
  const playerFields = (fields ?? []).filter((f) => f.scope !== 'round')
  return players.map((p) => {
    const data: Record<string, any> = {}
    for (const f of playerFields) {
      const value = coerce(f, values[p.player_id]?.[f.key])
      if (value !== undefined) data[f.key] = value
    }
    return { player_id: p.player_id, data }
  })
}

function findWinners(rows: ScoreboardRow[], direction: ScoreDirection): Set<number> {
  if (rows.length === 0) return new Set()
  const totals = rows.map((r) => r.total)
  const target = direction === 'low' ? Math.min(...totals) : Math.max(...totals)
  return new Set(rows.filter((r) => r.total === target).map((r) => r.player_id))
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const sessionId = Number(id)
  const [roundData, setRoundData] = useState<Record<string, string | number>>({})
  const [playerData, setPlayerData] = useState<Record<number, Record<string, string | number | boolean>>>({})
  const [expandedPlayers, setExpandedPlayers] = useState<Record<number, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [undoing, setUndoing] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Re-runs whenever any table it reads changes, so submit/undo/finish
  // don't need to reload by hand. `undefined` while loading; `null` when
  // the session doesn't exist.
  const data = useLiveQuery(async () => {
    const session = await getSession(sessionId).catch(() => null)
    if (!session) return null
    const [scoreboard, round] = await Promise.all([
      getScoreboard(sessionId),
      getCurrentRound(sessionId).catch(() => null),
    ])
    return { session, round, players: scoreboard.players, roundsMeta: scoreboard.rounds_meta }
  }, [sessionId])

  const session = data?.session ?? null
  const round = data?.round ?? null
  const players = useMemo(() => data?.players ?? [], [data])
  const roundsMeta = data?.roundsMeta ?? []

  async function handleSubmit() {
    if (!round) return
    setSubmitting(true)
    setError(null)

    try {
      const round_data = collectRoundData(round.fields, roundData)
      const scores = collectScores(round.fields, players, playerData)

      await submitRound(sessionId, { round_data, scores })

      setRoundData({})
      setPlayerData({})
    } catch (err: any) {
      setError(err.message)
    }

    setSubmitting(false)
  }

  async function handleUndo() {
    setUndoing(true)
    setError(null)
    try {
      await undoLastRound(sessionId)
      setPlayerData({})
      setRoundData({})
    } catch (err: any) {
      setError(err.message)
    }
    setUndoing(false)
  }

  async function handleFinish() {
    setFinishing(true)
    setError(null)
    try {
      await finishSession(sessionId)
    } catch (err: any) {
      setError(err.message)
    }
    setFinishing(false)
  }

  const direction: ScoreDirection =
    (session?.game && getGame(session.game.slug)?.scoreDirection) || 'high'

  const isComplete =
    session?.status === 'completed' || round?.complete === true

  const scoredCount = players.reduce(
    (max, row) => Math.max(max, row.scores.filter((s) => s !== null).length),
    0
  )
  const hasScoredRounds = scoredCount > 0

  const winners = useMemo(
    () => (isComplete ? findWinners(players, direction) : new Set<number>()),
    [isComplete, players, direction]
  )
  const leaders = useMemo(
    () =>
      !isComplete && hasScoredRounds
        ? findWinners(players, direction)
        : new Set<number>(),
    [isComplete, hasScoredRounds, players, direction]
  )

  const playerMap = useMemo(() => {
    const map: Record<number, string> = {}
    for (const p of session?.players ?? []) {
      map[p.id] = p.name
    }
    return map
  }, [session?.players])

  function getRoundMeta(roundNum: number): RoundMetaInfo | undefined {
    return roundsMeta.find((r) => r.round_number === roundNum)
  }

  function getTrumpForRound(roundNum: number): string | null {
    const meta = getRoundMeta(roundNum)
    if (!meta) return null
    return meta.data_json?.trump ?? null
  }

  function getDealerForRound(roundNum: number): string | null {
    const meta = getRoundMeta(roundNum)
    if (!meta) return null
    const dealerId = meta.data_json?.dealer_player_id
    return dealerId ? (playerMap[dealerId] ?? null) : null
  }

  if (data === undefined) return <p className="text-gray-500 dark:text-gray-400">Loading...</p>
  if (!session) return <p className="text-gray-500 dark:text-gray-400">Game not found.</p>

  const roundFields = round?.fields?.filter((f) => f.scope === 'round') ?? []
  const playerFields = round?.fields?.filter((f) => f.scope !== 'round') ?? []
  const totalRounds = session.total_rounds ?? 0
  const active = !isComplete && !!round && !round.complete
  const roundNumber = round && !round.complete ? round.round_number : null

  const rawRoundData: Record<string, any> = round?.data_json ?? {}
  const handSize: number = rawRoundData.handSize ?? 0

  const currentDealer =
    active && roundNumber !== null ? getDealerForRound(roundNumber) : null

  const trumpMissing = roundFields.some(
    (f) => f.required && (roundData[f.key] === undefined || roundData[f.key] === '')
  )
  const booleanFields = playerFields.filter((f) => f.type === 'boolean')
  const successMissing =
    booleanFields.length > 0 &&
    players.some((p) =>
      booleanFields.some((f) => playerData[p.player_id]?.[f.key] === undefined)
    )
  const gameImpl = session.game ? getGame(session.game.slug) : undefined
  const ruleViolation =
    active && round && gameImpl?.validateRound
      ? gameImpl.validateRound(
          {
            round_number: round.round_number,
            hand_size: handSize,
            data: { ...rawRoundData, ...collectRoundData(round.fields, roundData) },
          },
          collectScores(round.fields, players, playerData)
        )
      : null

  const roundLabel = isComplete
    ? 'Game complete'
    : roundNumber !== null
      ? `Round ${roundNumber}${totalRounds > 0 ? ` of ${totalRounds}` : ''}`
      : 'Round'

  const roundSub = isComplete
    ? `${scoredCount} round${scoredCount === 1 ? '' : 's'}`
    : currentDealer
      ? `Dealer: ${currentDealer}`
      : `${scoredCount} scored`

  const progressPct =
    totalRounds > 0 ? Math.min(100, (scoredCount / totalRounds) * 100) : 0

  const standings = [...players].sort((a, b) =>
    direction === 'low' ? a.total - b.total : b.total - a.total
  )
  const winnerNames = standings
    .filter((p) => winners.has(p.player_id))
    .map((p) => p.name)

  return (
    <div className="mx-auto max-w-xl pb-2">
      <header className="mb-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
          {session.title || session.game?.name || 'Game'}
        </h1>
        {session.game && (
          <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
            {session.game.name} · {direction === 'low' ? 'lowest' : 'highest'} total wins
          </p>
        )}
      </header>

      {/* Round bar: round status + Undo / Finish */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div
            data-testid="round-number"
            className="truncate text-base font-bold text-gray-900 dark:text-gray-100"
          >
            {roundLabel}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{roundSub}</div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {hasScoredRounds && (
            <button
              onClick={handleUndo}
              disabled={undoing}
              data-testid="undo-round"
              title="Undo last round"
              className="flex h-10 items-center gap-1 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-100 active:scale-[0.98] disabled:opacity-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {undoing ? '…' : '↶ Undo'}
            </button>
          )}
          {!isComplete && (
            <button
              onClick={handleFinish}
              disabled={!hasScoredRounds || finishing}
              data-testid="finish-game"
              title="Finish game"
              className="flex h-10 items-center rounded-lg border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 active:scale-[0.98] disabled:opacity-40 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-900/40"
            >
              {finishing ? '…' : 'Finish'}
            </button>
          )}
        </div>
      </div>

      {totalRounds > 0 && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            className="h-full rounded-full bg-blue-600 transition-all dark:bg-blue-500"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {error && !active && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {isComplete && (
        <section className="mb-3 rounded-xl border border-green-300 bg-gradient-to-b from-green-50 to-white p-4 dark:border-green-900/60 dark:from-green-950/40 dark:to-gray-900">
          <p className="text-base font-bold text-green-700 dark:text-green-300">
            🏆{' '}
            {winnerNames.length > 1
              ? `${winnerNames.join(' & ')} tie!`
              : `${winnerNames[0] ?? 'Winner'} wins!`}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {direction === 'low' ? 'Lowest' : 'Highest'} total after {scoredCount}{' '}
            round{scoredCount === 1 ? '' : 's'}
          </p>
          <div className="mt-2 space-y-1">
            {standings.map((p) => (
              <div
                key={p.player_id}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {p.name}
                </span>
                <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {p.total} pts
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div data-testid={isComplete ? undefined : 'current-round'}>
        {active && roundFields.length > 0 && (
          <section className="mb-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Round settings
            </p>
            <div className="flex flex-wrap items-center gap-3">
              {roundFields.map((f) => (
                <RoundFieldInput
                  key={f.key}
                  field={f}
                  value={roundData[f.key]}
                  onChange={(v) => setRoundData((prev) => ({ ...prev, [f.key]: v }))}
                />
              ))}
            </div>
          </section>
        )}

        <div data-testid="player-cards" className="space-y-3">
          {players.map((row) => (
            <PlayerCard
              key={row.player_id}
              row={row}
              active={active}
              roundNumber={roundNumber}
              handSize={handSize}
              fields={playerFields}
              values={playerData[row.player_id]}
              onChange={(key, value) =>
                setPlayerData((prev) => ({
                  ...prev,
                  [row.player_id]: { ...prev[row.player_id], [key]: value },
                }))
              }
              isLeader={leaders.has(row.player_id)}
              isWinner={winners.has(row.player_id)}
              hasScoredRounds={hasScoredRounds}
              expanded={!!expandedPlayers[row.player_id]}
              onToggle={() =>
                setExpandedPlayers((prev) => ({
                  ...prev,
                  [row.player_id]: !prev[row.player_id],
                }))
              }
              getTrump={getTrumpForRound}
            />
          ))}
        </div>
      </div>

      {active && round && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-gray-200 bg-white/90 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur dark:border-gray-800 dark:bg-gray-950/90">
          {error ? (
            <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          ) : (
            ruleViolation && (
              <p
                data-testid="round-rule-violation"
                className="mb-2 text-sm text-amber-700 dark:text-amber-400"
              >
                {ruleViolation}
              </p>
            )
          )}
          <button
            onClick={handleSubmit}
            disabled={
              submitting ||
              !!ruleViolation ||
              trumpMissing ||
              successMissing
            }
            data-testid="submit-round"
            className="h-12 w-full rounded-xl bg-blue-600 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-50 dark:hover:bg-blue-800"
          >
            {submitting ? 'Saving...' : `Submit Round ${round.round_number}`}
          </button>
          <p className="mt-1 text-center text-[11px] text-gray-400 dark:text-gray-500">
            One submit saves all player scores
          </p>
        </div>
      )}
    </div>
  )
}

function PlayerCard({
  row,
  active,
  roundNumber,
  handSize,
  fields,
  values,
  onChange,
  isLeader,
  isWinner,
  hasScoredRounds,
  expanded,
  onToggle,
  getTrump,
}: {
  row: ScoreboardRow
  active: boolean
  roundNumber: number | null
  handSize: number
  fields: InputField[]
  values: Record<string, string | number | boolean> | undefined
  onChange: (key: string, value: string | number | boolean) => void
  isLeader: boolean
  isWinner: boolean
  hasScoredRounds: boolean
  expanded: boolean
  onToggle: () => void
  getTrump: (roundNumber: number) => string | null
}) {
  const scoredEntries = row.scores
    .map((score, index) => ({ roundNumber: index + 1, score }))
    .filter(
      (entry): entry is { roundNumber: number; score: number } =>
        entry.score !== null
    )

  const recent = scoredEntries.slice(-2)

  const cardTone = isWinner
    ? 'border-amber-400 bg-gradient-to-b from-amber-50 to-white dark:border-amber-500/60 dark:from-amber-950/30 dark:to-gray-900'
    : active && isLeader && hasScoredRounds
      ? 'border-amber-300 ring-1 ring-amber-200 dark:border-amber-500/50 dark:ring-amber-500/20'
      : 'border-gray-200 dark:border-gray-800'

  return (
    <article
      data-testid="player-card"
      data-player-name={row.name}
      className={`rounded-xl border bg-white p-3.5 shadow-sm dark:bg-gray-900 ${cardTone}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-sm font-bold text-gray-900 dark:text-gray-100">
            <span className="truncate">{row.name}</span>
            {isWinner && <span aria-label="Winner">👑</span>}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span
              data-testid="player-total"
              className="text-3xl font-extrabold leading-none tracking-tight text-gray-900 dark:text-gray-100"
            >
              {row.total}
            </span>
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
              pts
            </span>
          </div>
        </div>
        {active && isLeader && hasScoredRounds && (
          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
            Leading
          </span>
        )}
      </div>

      {active && roundNumber !== null && (
        <div className="mt-3 border-t border-dashed border-gray-200 pt-2.5 dark:border-gray-700">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              This round
            </span>
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">
              R{roundNumber}
              {handSize > 0 ? ` · ${handSize} card${handSize === 1 ? '' : 's'}` : ''}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {fields.map((field) => (
              <CardFieldInput
                key={field.key}
                field={field}
                playerName={row.name}
                value={values?.[field.key]}
                onChange={(v) => onChange(field.key, v)}
              />
            ))}
          </div>
        </div>
      )}

      {scoredEntries.length > 0 && (
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {recent.map((entry) => {
              const trump = getTrump(entry.roundNumber)
              return (
                <span
                  key={entry.roundNumber}
                  data-testid="recent-round-chip"
                  className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[11px] text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
                >
                  <span>R{entry.roundNumber}</span>
                  {trump && (
                    <span className={SUIT_COLORS[trump] ?? ''}>{trump}</span>
                  )}
                  <b className="font-bold text-gray-900 dark:text-gray-100">
                    {entry.score}
                  </b>
                </span>
              )
            })}
          </div>
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-label={`${expanded ? 'Hide' : 'Show'} all rounds for ${row.name}`}
            className="shrink-0 py-1 text-[11px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            {expanded ? 'Hide rounds ⌃' : 'All rounds ›'}
          </button>
        </div>
      )}

      {expanded && row.scores.length > 0 && (
        <div
          data-testid="round-history"
          className="mt-2.5 grid grid-cols-4 gap-1.5 border-t border-dashed border-gray-200 pt-2.5 sm:grid-cols-6 dark:border-gray-700"
        >
          {row.scores.map((score, index) => {
            const historyRound = index + 1
            const trump = getTrump(historyRound)
            const isCurrent = roundNumber === historyRound
            return (
              <div
                key={historyRound}
                className={`rounded-md border px-1 py-1 text-center leading-tight ${
                  isCurrent
                    ? 'border-dashed border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/70 dark:bg-blue-950/40 dark:text-blue-300'
                    : 'border-gray-200 bg-gray-50 text-gray-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-500'
                }`}
              >
                <span className="block text-[10px]">R{historyRound}</span>
                {trump && (
                  <span className={`block text-xs ${SUIT_COLORS[trump] ?? ''}`}>
                    {trump}
                  </span>
                )}
                <span className="block text-xs font-bold text-gray-900 dark:text-gray-100">
                  {score ?? '—'}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </article>
  )
}

function CardFieldInput({
  field,
  playerName,
  value,
  onChange,
}: {
  field: InputField
  playerName: string
  value: string | number | boolean | undefined
  onChange: (v: string | number | boolean) => void
}) {
  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {field.label}
        </span>
        <div className="inline-flex h-11 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => onChange(false)}
            aria-label={`${playerName} ${field.label} no`}
            aria-pressed={value === false}
            className={`w-11 text-base font-bold transition active:scale-[0.97] ${
              value === false
                ? 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                : 'bg-white text-gray-400 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-500 dark:hover:bg-gray-700'
            }`}
          >
            ✗
          </button>
          <button
            type="button"
            onClick={() => onChange(true)}
            aria-label={`${playerName} ${field.label} yes`}
            aria-pressed={value === true}
            className={`w-11 border-l border-gray-200 text-base font-bold transition active:scale-[0.97] dark:border-gray-700 ${
              value === true
                ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                : 'bg-white text-gray-400 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-500 dark:hover:bg-gray-700'
            }`}
          >
            ✓
          </button>
        </div>
      </div>
    )
  }

  if (field.type === 'select' && field.options) {
    return (
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <span className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
          {field.label}
        </span>
        <select
          value={(value ?? '') as string | number}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${playerName} ${field.label}`}
          className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-blue-400"
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

  const allowsNegative = field.min === undefined || field.min < 0
  const numericValue = Number(value)

  return (
    <label className="flex min-w-0 flex-1 items-center gap-2">
      <span className="shrink-0 text-xs font-medium text-gray-500 dark:text-gray-400">
        {field.label}
      </span>
      <input
        type="number"
        min={field.min}
        max={field.max}
        value={value === undefined ? '' : (value as string | number)}
        onChange={(e) => {
          const raw = e.target.value
          onChange(raw === '' ? '' : raw)
        }}
        placeholder="0"
        inputMode={allowsNegative ? 'decimal' : 'numeric'}
        aria-label={`${playerName} ${field.label}`}
        className="h-11 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-base font-semibold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-blue-400"
      />
      {allowsNegative && (
        <button
          type="button"
          onClick={() => {
            if (value === undefined || value === '') return
            onChange(String(-numericValue))
          }}
          aria-label={`${playerName} ${field.label} toggle sign`}
          className="h-11 w-11 shrink-0 rounded-lg border border-gray-200 bg-gray-50 text-base font-bold text-gray-600 transition hover:bg-gray-100 active:scale-[0.97] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          ±
        </button>
      )}
    </label>
  )
}

function RoundFieldInput({
  field,
  value,
  onChange,
}: {
  field: InputField
  value: string | number | undefined
  onChange: (v: string | number) => void
}) {
  if (field.type === 'select' && field.options) {
    const isSuitField = field.options.every((s) => SUIT_SYMBOLS.has(s))

    if (isSuitField) {
      return (
        <div>
          <p className="mb-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
            {field.label}
          </p>
          <div className="flex gap-1.5">
            {field.options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(opt)}
                aria-label={`${field.label} ${opt}`}
                aria-pressed={value === opt}
                className={`flex h-11 w-11 items-center justify-center rounded-lg border-2 text-xl transition active:scale-[0.95] ${
                  value === opt
                    ? 'border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-900/30'
                    : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-gray-600'
                } ${SUIT_COLORS[opt] ?? 'text-gray-500 dark:text-gray-400'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )
    }

    return (
      <label className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <span>{field.label}</span>
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          aria-label={field.label}
          className="h-11 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-blue-400"
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
    <label className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
      <span>{field.label}</span>
      <input
        type="number"
        min={field.min}
        max={field.max}
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        inputMode="numeric"
        aria-label={field.label}
        className="h-11 w-20 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:focus:ring-blue-400"
      />
    </label>
  )
}
