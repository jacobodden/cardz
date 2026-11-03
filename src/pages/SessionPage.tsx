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
import { topByTotal } from '../games/standings'
import type { InputField, PlayerScoreInput, RoundInfoChip, ScoreDirection } from '../games/types'

const SUIT_SYMBOLS = new Set(['♠', '♥', '♣', '♦'])

const CHIP_TONES: Record<NonNullable<RoundInfoChip['tone']>, string> = {
  red: 'text-red-suit',
}

function chipTone(chip: RoundInfoChip): string {
  return chip.tone ? CHIP_TONES[chip.tone] : 'text-ink'
}

const SUIT_COLORS: Record<string, string> = {
  '♠': 'text-ink',
  '♥': 'text-red-suit',
  '♣': 'text-ink',
  '♦': 'text-red-suit',
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
  return new Set(topByTotal(rows, direction).map((r) => r.player_id))
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

  const gameImpl = session?.game ? getGame(session.game.slug) : undefined

  /** The game's info chips for a round, from its stored data. */
  function roundInfo(roundNum: number, data: Record<string, any> | undefined): RoundInfoChip[] {
    if (!gameImpl?.getRoundInfo || !data) return []
    return gameImpl.getRoundInfo(
      { round_number: roundNum, hand_size: data.handSize ?? 0, data },
      { players: session?.players ?? [] },
    )
  }

  function getHistoryInfo(roundNum: number): RoundInfoChip[] {
    const meta: RoundMetaInfo | undefined = roundsMeta.find((r) => r.round_number === roundNum)
    return roundInfo(roundNum, meta?.data_json).filter((chip) => chip.history)
  }

  if (data === undefined) return <p className="text-muted">Loading...</p>
  if (!session) return <p className="text-muted">Game not found.</p>

  const roundFields = round?.fields?.filter((f) => f.scope === 'round') ?? []
  const playerFields = round?.fields?.filter((f) => f.scope !== 'round') ?? []
  const totalRounds = session.total_rounds ?? 0
  const active = !isComplete && !!round && !round.complete
  const roundNumber = round && !round.complete ? round.round_number : null

  const rawRoundData: Record<string, any> = round?.data_json ?? {}
  const handSize: number = rawRoundData.handSize ?? 0

  const currentInfo =
    active && roundNumber !== null ? roundInfo(roundNumber, rawRoundData) : []

  const requiredRoundFieldMissing = roundFields.some(
    (f) => f.required && (roundData[f.key] === undefined || roundData[f.key] === '')
  )
  const booleanFields = playerFields.filter((f) => f.type === 'boolean')
  const successMissing =
    booleanFields.length > 0 &&
    players.some((p) =>
      booleanFields.some((f) => playerData[p.player_id]?.[f.key] === undefined)
    )
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
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          {session.title || session.game?.name || 'Game'}
        </h1>
        {session.game && (
          <p className="mt-0.5 text-sm text-muted">
            {session.game.name} · {direction === 'low' ? 'lowest' : 'highest'} total wins
          </p>
        )}
      </header>

      {/* Round bar: round status + Undo / Finish */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div
            data-testid="round-number"
            className="truncate text-base font-bold text-ink"
          >
            {roundLabel}
          </div>
          <div className="text-xs text-muted">{roundSub}</div>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {hasScoredRounds && (
            <button
              onClick={handleUndo}
              disabled={undoing}
              data-testid="undo-round"
              title="Undo last round"
              className="flex h-10 items-center gap-1 rounded-lg border border-line-strong px-3 text-sm font-medium text-muted transition hover:bg-surface-2 active:scale-[0.98] disabled:opacity-50"
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
              className="flex h-10 items-center rounded-lg border border-no-fg/30 bg-no-bg px-3 text-sm font-semibold text-no-fg transition hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
            >
              {finishing ? '…' : 'Finish'}
            </button>
          )}
        </div>
      </div>

      {currentInfo.length > 0 && (
        <div data-testid="round-info" className="mb-3 flex flex-wrap gap-1.5">
          {currentInfo.map((chip) => (
            <span
              key={chip.key}
              data-testid="round-info-chip"
              data-chip={chip.key}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs"
            >
              <span className="text-muted">{chip.label}</span>
              <b className={`font-semibold ${chipTone(chip)}`}>{chip.value}</b>
            </span>
          ))}
        </div>
      )}

      {totalRounds > 0 && (
        <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {error && !active && (
        <p className="mb-3 text-sm text-danger">{error}</p>
      )}

      {isComplete && (
        <section className="mb-3 rounded-xl border border-accent-ink/40 bg-gradient-to-b from-accent-soft to-surface p-4">
          <p className="text-base font-bold text-accent-ink">
            🏆{' '}
            {winnerNames.length > 1
              ? `${winnerNames.join(' & ')} tie!`
              : `${winnerNames[0] ?? 'Winner'} wins!`}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {direction === 'low' ? 'Lowest' : 'Highest'} total after {scoredCount}{' '}
            round{scoredCount === 1 ? '' : 's'}
          </p>
          <div className="mt-2 space-y-1">
            {standings.map((p) => (
              <div
                key={p.player_id}
                className="flex items-baseline justify-between gap-3"
              >
                <span className="text-sm font-medium text-ink">
                  {p.name}
                </span>
                <span className="text-sm font-bold text-ink">
                  {p.total} pts
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div data-testid={isComplete ? undefined : 'current-round'}>
        {active && roundFields.length > 0 && (
          <section className="mb-3 rounded-xl border border-line bg-surface p-3">
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
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
              getHistoryInfo={getHistoryInfo}
            />
          ))}
        </div>
      </div>

      {active && round && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 border-t border-line bg-surface/90 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
          {error ? (
            <p className="mb-2 text-sm text-danger">{error}</p>
          ) : (
            ruleViolation && (
              <p
                data-testid="round-rule-violation"
                className="mb-2 text-sm text-warn"
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
              requiredRoundFieldMissing ||
              successMissing
            }
            data-testid="submit-round"
            className="h-12 w-full rounded-xl bg-accent text-sm font-bold text-on-accent transition hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
          >
            {submitting ? 'Saving...' : `Submit Round ${round.round_number}`}
          </button>
          <p className="mt-1 text-center text-[11px] text-muted">
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
  getHistoryInfo,
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
  getHistoryInfo: (roundNumber: number) => RoundInfoChip[]
}) {
  const scoredEntries = row.scores
    .map((score, index) => ({ roundNumber: index + 1, score }))
    .filter(
      (entry): entry is { roundNumber: number; score: number } =>
        entry.score !== null
    )

  const recent = scoredEntries.slice(-2)

  const cardTone = isWinner
    ? 'border-lead-border bg-gradient-to-b from-lead-bg to-surface'
    : active && isLeader && hasScoredRounds
      ? 'border-lead-border ring-1 ring-lead-border/50'
      : 'border-line'

  return (
    <article
      data-testid="player-card"
      data-player-name={row.name}
      className={`rounded-xl border bg-surface p-3.5 shadow-sm ${cardTone}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1 text-sm font-bold text-ink">
            <span className="truncate">{row.name}</span>
            {isWinner && <span aria-label="Winner">👑</span>}
          </div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span
              data-testid="player-total"
              className="text-3xl font-extrabold leading-none tracking-tight text-ink"
            >
              {row.total}
            </span>
            <span className="text-xs font-semibold text-muted">
              pts
            </span>
          </div>
        </div>
        {active && isLeader && hasScoredRounds && (
          <span className="shrink-0 rounded-full bg-lead-bg px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-lead-label">
            Leading
          </span>
        )}
      </div>

      {active && roundNumber !== null && (
        <div className="mt-3 border-t border-dashed border-line pt-2.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
              This round
            </span>
            <span className="text-[11px] font-semibold text-muted">
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
              const info = getHistoryInfo(entry.roundNumber)
              return (
                <span
                  key={entry.roundNumber}
                  data-testid="recent-round-chip"
                  className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted"
                >
                  <span>R{entry.roundNumber}</span>
                  {info.map((chip) => (
                    <span key={chip.key} title={chip.label} className={chipTone(chip)}>
                      {chip.value}
                    </span>
                  ))}
                  <b className="font-bold text-ink">
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
            className="shrink-0 py-1 text-[11px] font-bold text-accent-ink hover:opacity-80"
          >
            {expanded ? 'Hide rounds ⌃' : 'All rounds ›'}
          </button>
        </div>
      )}

      {expanded && row.scores.length > 0 && (
        <div
          data-testid="round-history"
          className="mt-2.5 grid grid-cols-4 gap-1.5 border-t border-dashed border-line pt-2.5 sm:grid-cols-6"
        >
          {row.scores.map((score, index) => {
            const historyRound = index + 1
            const info = getHistoryInfo(historyRound)
            const isCurrent = roundNumber === historyRound
            return (
              <div
                key={historyRound}
                className={`rounded-md border px-1 py-1 text-center leading-tight ${
                  isCurrent
                    ? 'border-dashed border-accent-ink bg-accent-soft text-accent-ink'
                    : 'border-line bg-surface-2 text-muted'
                }`}
              >
                <span className="block text-[10px]">R{historyRound}</span>
                {info.map((chip) => (
                  <span key={chip.key} title={chip.label} className={`block text-xs ${chipTone(chip)}`}>
                    {chip.value}
                  </span>
                ))}
                <span className="block text-xs font-bold text-ink">
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
        <span className="text-xs font-medium text-muted">
          {field.label}
        </span>
        <div className="inline-flex h-11 overflow-hidden rounded-lg border border-line">
          <button
            type="button"
            onClick={() => onChange(false)}
            aria-label={`${playerName} ${field.label} no`}
            aria-pressed={value === false}
            className={`w-11 text-base font-bold transition active:scale-[0.97] ${
              value === false
                ? 'bg-no-bg text-no-fg'
                : 'bg-surface text-muted hover:bg-surface-2'
            }`}
          >
            ✗
          </button>
          <button
            type="button"
            onClick={() => onChange(true)}
            aria-label={`${playerName} ${field.label} yes`}
            aria-pressed={value === true}
            className={`w-11 border-l border-line text-base font-bold transition active:scale-[0.97] ${
              value === true
                ? 'bg-yes-bg text-yes-fg'
                : 'bg-surface text-muted hover:bg-surface-2'
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
        <span className="shrink-0 text-xs font-medium text-muted">
          {field.label}
        </span>
        <select
          value={(value ?? '') as string | number}
          onChange={(e) => onChange(e.target.value)}
          aria-label={`${playerName} ${field.label}`}
          className="h-11 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-base text-ink focus:outline-none focus:ring-2 focus:ring-accent-ink"
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
      <span className="shrink-0 text-xs font-medium text-muted">
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
        className="h-11 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface px-3 text-base font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-accent-ink"
      />
      {allowsNegative && (
        <button
          type="button"
          onClick={() => {
            if (value === undefined || value === '') return
            onChange(String(-numericValue))
          }}
          aria-label={`${playerName} ${field.label} toggle sign`}
          className="h-11 w-11 shrink-0 rounded-lg border border-line bg-surface-2 text-base font-bold text-muted transition hover:bg-surface-2 active:scale-[0.97]"
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
          <p className="mb-1.5 text-xs font-medium text-muted">
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
                    ? 'border-accent-ink bg-accent-soft'
                    : 'border-line bg-surface hover:border-line-strong'
                } ${SUIT_COLORS[opt] ?? 'text-muted'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )
    }

    return (
      <label className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <span>{field.label}</span>
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          aria-label={field.label}
          className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent-ink"
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
    <label className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
      <span>{field.label}</span>
      <input
        type="number"
        min={field.min}
        max={field.max}
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        inputMode="numeric"
        aria-label={field.label}
        className="h-11 w-20 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent-ink"
      />
    </label>
  )
}
