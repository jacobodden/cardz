import { useContext, useMemo, useState } from 'react'
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
import FeltHero from '../components/FeltHero'
import HeaderActions from '../components/HeaderActions'
import { HeroSlotContext } from '../components/heroSlot'

const SUIT_SYMBOLS = new Set(['♠', '♥', '♣', '♦'])
const RED_SUITS = new Set(['♥', '♦'])

const CHIP_TONES: Record<NonNullable<RoundInfoChip['tone']>, string> = {
  red: 'text-red-suit',
}

function chipTone(chip: RoundInfoChip): string {
  return chip.tone ? CHIP_TONES[chip.tone] : 'text-ink'
}

type FieldValue = string | number | boolean

function coerce(field: InputField, raw: FieldValue | undefined) {
  if (raw === undefined || raw === '') return undefined
  return field.type === 'number' ? Number(raw) : raw
}

/** A select whose options are all card suits, shown as playing cards. */
function isSuitField(field: InputField): boolean {
  return field.type === 'select' && !!field.options?.every((s) => SUIT_SYMBOLS.has(s))
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

function ordinal(n: number): string {
  const tens = n % 100
  if (tens >= 11 && tens <= 13) return `${n}th`
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`
}

/** Competition rank of `total`: 1 + how many totals beat it (ties share a rank). */
function rankOf(total: number, totals: number[], direction: ScoreDirection): number {
  return 1 + totals.filter((t) => (direction === 'low' ? t < total : t > total)).length
}

/** Standings tiles per row: wraps 4+ players so names and totals stay readable. */
function standingColumns(count: number): number {
  if (count <= 3) return Math.max(count, 1)
  return count === 4 ? 2 : 3
}

function formatRoundScore(score: number, direction: ScoreDirection): string {
  return direction === 'high' && score > 0 ? `+${score}` : String(score)
}

export default function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const sessionId = Number(id)
  const { iconButton } = useContext(HeroSlotContext)
  const [roundData, setRoundData] = useState<Record<string, string | number>>({})
  const [playerData, setPlayerData] = useState<Record<number, Record<string, FieldValue>>>({})
  const [showHistory, setShowHistory] = useState(false)
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
  const suitFields = roundFields.filter(isSuitField)
  const otherRoundFields = roundFields.filter((f) => !isSuitField(f))
  const playerFields = round?.fields?.filter((f) => f.scope !== 'round') ?? []
  const totalRounds = session.total_rounds ?? 0
  const active = !isComplete && !!round && !round.complete
  const roundNumber = round && !round.complete ? round.round_number : null

  const rawRoundData: Record<string, any> = round?.data_json ?? {}
  const handSize: number = rawRoundData.handSize ?? 0

  // Facts for the band's round line. Chips for fields being entered (trump)
  // are left out: the inputs already show them.
  const currentInfo =
    active && roundNumber !== null
      ? roundInfo(roundNumber, rawRoundData).filter(
          (chip) => !roundFields.some((f) => f.key === chip.key)
        )
      : []

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

  const progressPct =
    totalRounds > 0 ? Math.min(100, (scoredCount / totalRounds) * 100) : 0

  const totals = players.map((p) => p.total)
  const winnerRows = players.filter((p) => winners.has(p.player_id))

  // "Bids so far" line for the first stepper field.
  const stepperField = playerFields.find((f) => f.stepper)
  const stillToEnter = stepperField
    ? players.filter((p) => coerce(stepperField, playerData[p.player_id]?.[stepperField.key]) === undefined)
    : []

  /** Best scorer(s) of a round, for the recent-round chips. */
  function roundBest(roundNum: number): { names: string; score: number } | null {
    const rows = players
      .map((p) => ({ name: p.name, total: p.scores[roundNum - 1] }))
      .filter((r): r is { name: string; total: number } => r.total !== null && r.total !== undefined)
    const best = topByTotal(rows, direction)
    if (best.length === 0) return null
    return { names: best.map((r) => r.name).join(' & '), score: best[0].total }
  }

  const scoredRounds = Array.from({ length: scoredCount }, (_, i) => i + 1)
  const recentRounds = scoredRounds.slice(-2)

  return (
    <div className="mx-auto max-w-xl">
      <HeaderActions>
        {hasScoredRounds && (
          <button
            type="button"
            onClick={handleUndo}
            disabled={undoing}
            data-testid="undo-round"
            title="Undo last round"
            aria-label="Undo last round"
            className={iconButton}
          >
            <UndoIcon />
          </button>
        )}
      </HeaderActions>

      <FeltHero>
        <div className="mx-auto max-w-xl pb-4">
          {session.game && (
            <p className="text-[13px] font-semibold text-on-felt/80">
              {session.game.name} · {direction === 'low' ? 'lowest' : 'highest'} total wins
            </p>
          )}
          <h1 className="text-2xl leading-tight font-extrabold tracking-tight">
            {session.title || session.game?.name || 'Game'}
          </h1>
          <p className="mt-0.5 text-sm text-on-felt/85">
            <span data-testid="round-number">{roundLabel}</span>
            {isComplete && (
              <span>
                {' · '}
                {scoredCount} round{scoredCount === 1 ? '' : 's'}
              </span>
            )}
            {currentInfo.map((chip) => (
              <span key={chip.key}>
                {' · '}
                <span data-testid="round-info-chip" data-chip={chip.key}>
                  {chip.label} {chip.value}
                </span>
              </span>
            ))}
            {active && handSize > 0 && (
              <span data-testid="hand-size">
                {' · '}
                {handSize} card{handSize === 1 ? '' : 's'}
              </span>
            )}
          </p>
          {totalRounds > 0 && (
            <div
              role="progressbar"
              aria-label="Rounds played"
              aria-valuemin={0}
              aria-valuemax={totalRounds}
              aria-valuenow={scoredCount}
              className="mt-2.5 h-[5px] overflow-hidden rounded-full bg-on-felt/25"
            >
              <div
                className="h-full rounded-full bg-on-felt transition-all"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          )}
          {active &&
            suitFields.map((f) => (
              <SuitCards
                key={f.key}
                field={f}
                value={roundData[f.key]}
                onChange={(v) => setRoundData((prev) => ({ ...prev, [f.key]: v }))}
              />
            ))}
        </div>
      </FeltHero>

      {error && !active && <p className="mb-3 text-sm text-danger">{error}</p>}

      {isComplete && (
        <section
          data-testid="winner-panel"
          className="mb-3 flex items-center gap-3 rounded-2xl border border-lead-border bg-lead-bg p-4"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-lead-label">
            <TrophyIcon />
          </span>
          <div className="min-w-0">
            <p className="text-lg leading-tight font-extrabold text-ink">
              {winnerRows.length > 1
                ? `${winnerRows.map((p) => p.name).join(' & ')} tie!`
                : `${winnerRows[0]?.name ?? 'Winner'} wins!`}
            </p>
            <p className="mt-0.5 text-sm text-lead-label">
              {direction === 'low' ? 'Lowest' : 'Highest'} total after {scoredCount} round
              {scoredCount === 1 ? '' : 's'}
              {winnerRows[0] && ` · ${winnerRows[0].total} pts`}
            </p>
          </div>
        </section>
      )}

      <section
        aria-label="Standings"
        data-testid="standings"
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${standingColumns(players.length)}, minmax(0, 1fr))` }}
      >
        {players.map((row) => {
          const top = winners.has(row.player_id) || leaders.has(row.player_id)
          const rankLabel = isComplete
            ? top
              ? 'Winner'
              : ordinal(rankOf(row.total, totals, direction))
            : !hasScoredRounds
              ? '–'
              : top
                ? 'Leading'
                : ordinal(rankOf(row.total, totals, direction))
          return (
            <div
              key={row.player_id}
              data-testid="player-standing"
              data-player-name={row.name}
              className={`min-w-0 rounded-xl border px-2.5 py-2 ${
                top ? 'border-lead-border bg-lead-bg' : 'border-line bg-surface'
              }`}
            >
              <p className={`text-xs font-bold ${top ? 'text-lead-label' : 'text-muted'}`}>
                {rankLabel}
              </p>
              <p className="flex items-baseline justify-between gap-1.5">
                <span className="min-w-0 truncate text-sm font-semibold text-ink">{row.name}</span>
                <span
                  data-testid="player-total"
                  className="shrink-0 text-xl font-extrabold tabular-nums text-ink"
                >
                  {row.total}
                </span>
              </p>
            </div>
          )
        })}
      </section>

      {active && round && (
        <div data-testid="current-round" className="mt-3">
          {otherRoundFields.length > 0 && (
            <section className="mb-2.5 rounded-[14px] border border-line bg-surface p-3">
              <p className="mb-2 text-[11px] font-bold tracking-wider text-muted uppercase">
                Round settings
              </p>
              <div className="flex flex-wrap items-center gap-3">
                {otherRoundFields.map((f) => (
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

          <TypedFieldCaptions fields={playerFields} />

          <div data-testid="player-rows" className="space-y-2.5">
            {players.map((row) => (
              <div
                key={row.player_id}
                data-testid="player-row"
                data-player-name={row.name}
                className="flex items-center gap-2.5 rounded-[14px] border border-line bg-surface py-2.5 pr-3 pl-3"
              >
                <span className="min-w-0 flex-1 truncate text-base font-bold text-ink">{row.name}</span>
                {playerFields.map((field) => (
                  <PlayerFieldInput
                    key={field.key}
                    field={field}
                    playerName={row.name}
                    value={playerData[row.player_id]?.[field.key]}
                    onChange={(v) =>
                      setPlayerData((prev) => ({
                        ...prev,
                        [row.player_id]: { ...prev[row.player_id], [field.key]: v },
                      }))
                    }
                  />
                ))}
              </div>
            ))}
          </div>

          {stepperField && (
            <p data-testid="stepper-progress" className="mt-2.5 text-[13px] text-muted">
              {stepperField.label}s so far: {players.length - stillToEnter.length} of {players.length}
              {stillToEnter.length > 0 &&
                ` · ${stillToEnter.map((p) => p.name).join(', ')} still to ${stepperField.label.toLowerCase()}`}
            </p>
          )}
        </div>
      )}

      {hasScoredRounds && (
        <section aria-label="Rounds" className="mt-3">
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-xs text-muted">Recent:</span>
            <div className="flex min-w-0 flex-1 gap-1.5 overflow-hidden">
              {recentRounds.map((n) => {
                const best = roundBest(n)
                return (
                  <span
                    key={n}
                    data-testid="recent-round-chip"
                    className="min-w-0 truncate rounded-md border border-line bg-surface px-2 py-0.5 text-xs whitespace-nowrap text-ink"
                  >
                    R{n}
                    {getHistoryInfo(n).map((chip) => (
                      <span key={chip.key} title={chip.label} className={`ml-1 ${chipTone(chip)}`}>
                        {chip.value}
                      </span>
                    ))}
                    {best && ` ${best.names} ${formatRoundScore(best.score, direction)}`}
                  </span>
                )
              })}
            </div>
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              aria-expanded={showHistory}
              aria-controls="round-history"
              className="-mr-1 flex h-11 shrink-0 items-center px-1 text-xs font-bold text-accent-ink hover:opacity-80"
            >
              {showHistory ? 'Hide rounds' : 'All rounds'}
            </button>
          </div>

          {showHistory && (
            <RoundHistory
              players={players}
              rounds={scoredRounds}
              direction={direction}
              getHistoryInfo={getHistoryInfo}
            />
          )}
        </section>
      )}

      {active && round && (
        <div className="sticky bottom-0 z-10 -mx-4 mt-4 -mb-4 border-t border-line bg-page/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:-mb-6">
          {error ? (
            <p className="mb-2 text-sm text-danger">{error}</p>
          ) : (
            ruleViolation && (
              <p data-testid="round-rule-violation" className="mb-2 text-sm text-warn">
                {ruleViolation}
              </p>
            )
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleFinish}
              disabled={!hasScoredRounds || finishing}
              data-testid="finish-game"
              title="Finish game"
              className="h-[52px] shrink-0 rounded-[14px] border border-line bg-surface px-4 text-[15px] font-bold text-danger transition hover:bg-surface-2 active:scale-[0.98] disabled:opacity-50"
            >
              {finishing ? '…' : 'Finish'}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !!ruleViolation || requiredRoundFieldMissing || successMissing}
              data-testid="submit-round"
              className="h-[52px] min-w-0 flex-1 rounded-[14px] bg-felt text-[17px] font-extrabold text-on-felt transition hover:opacity-90 active:scale-[0.99] disabled:opacity-55"
            >
              {submitting ? 'Saving...' : `Submit round ${round.round_number}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

/** Trump (or any suit) choice as four playing cards in the felt band. */
function SuitCards({
  field,
  value,
  onChange,
}: {
  field: InputField
  value: string | number | undefined
  onChange: (v: string) => void
}) {
  return (
    <div role="group" aria-label={field.label} className="mt-3.5 flex items-center gap-2.5">
      <span className="w-[50px] shrink-0 text-[13px] font-bold text-on-felt/90">{field.label}</span>
      {field.options!.map((opt) => {
        const selected = value === opt
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            aria-label={`${field.label} ${opt}`}
            aria-pressed={selected}
            className={`flex h-[60px] w-[52px] items-center justify-center rounded-lg bg-card-face text-[26px] leading-none transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-on-felt ${
              RED_SUITS.has(opt) ? 'text-card-red' : 'text-card-black'
            } ${
              selected
                ? '-translate-y-1 shadow-lg ring-3 ring-card-ring'
                : 'shadow-[0_2px_4px_rgb(0_0_0/0.25)] active:translate-y-0.5'
            }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

/** Fields whose input is typed into a number box get a caption above the rows. */
function isTypedNumber(field: InputField): boolean {
  return field.type === 'number' && !field.stepper
}

function allowsNegative(field: InputField): boolean {
  return field.min === undefined || field.min < 0
}

function TypedFieldCaptions({ fields }: { fields: InputField[] }) {
  if (!fields.some(isTypedNumber)) return null
  return (
    <div aria-hidden="true" className="mb-1 flex justify-end gap-2.5 px-3 text-xs font-semibold text-muted">
      {fields.filter(isTypedNumber).map((f) => (
        <span key={f.key} className="flex gap-1">
          {/* Centered over the input; a long label overflows both sides evenly. */}
          <span className="flex w-28 justify-center whitespace-nowrap">{f.label}</span>
          {allowsNegative(f) && <span className="w-11" />}
        </span>
      ))}
    </div>
  )
}

function PlayerFieldInput({
  field,
  playerName,
  value,
  onChange,
}: {
  field: InputField
  playerName: string
  value: FieldValue | undefined
  onChange: (v: FieldValue) => void
}) {
  const label = `${playerName} ${field.label}`

  if (field.type === 'boolean') {
    return (
      <div className="flex h-11 shrink-0 overflow-hidden rounded-[10px] border border-line">
        <button
          type="button"
          onClick={() => onChange(false)}
          aria-label={`${label} no`}
          aria-pressed={value === false}
          className={`w-11 text-base font-extrabold transition active:scale-[0.97] ${
            value === false ? 'bg-no-bg text-no-fg' : 'bg-surface text-muted hover:bg-surface-2'
          }`}
        >
          ✗
        </button>
        <button
          type="button"
          onClick={() => onChange(true)}
          aria-label={`${label} yes`}
          aria-pressed={value === true}
          className={`w-11 border-l border-line text-base font-extrabold transition active:scale-[0.97] ${
            value === true ? 'bg-yes-bg text-yes-fg' : 'bg-surface text-muted hover:bg-surface-2'
          }`}
        >
          ✓
        </button>
      </div>
    )
  }

  if (field.type === 'select' && field.options) {
    return (
      <select
        value={(value ?? '') as string | number}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        className="h-11 w-32 shrink-0 rounded-[10px] border border-line-strong bg-surface px-3 text-base text-ink focus:ring-2 focus:ring-accent-ink focus:outline-none"
      >
        <option value="" disabled>
          {field.label}
        </option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    )
  }

  if (field.stepper) {
    return <Stepper field={field} label={label} value={value} onChange={onChange} />
  }

  const negative = allowsNegative(field)
  return (
    <div className="flex shrink-0 gap-1">
      <input
        type="number"
        min={field.min}
        max={field.max}
        value={value === undefined ? '' : (value as string | number)}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        inputMode={negative ? 'decimal' : 'numeric'}
        aria-label={label}
        className="h-11 w-28 rounded-[10px] border border-line-strong bg-surface px-3 text-center text-base font-semibold text-ink tabular-nums focus:ring-2 focus:ring-accent-ink focus:outline-none"
      />
      {negative && (
        <button
          type="button"
          onClick={() => {
            if (value === undefined || value === '') return
            onChange(String(-Number(value)))
          }}
          aria-label={`${label} toggle sign`}
          className="h-11 w-11 rounded-[10px] border border-line bg-surface-2 text-base font-bold text-muted transition active:scale-[0.97]"
        >
          ±
        </button>
      )}
    </div>
  )
}

/**
 * −/+ entry for a small count. Starts unset ("–"): − sets the minimum and
 * + sets one above it, so a bid of 0 is one tap.
 */
function Stepper({
  field,
  label,
  value,
  onChange,
}: {
  field: InputField
  label: string
  value: FieldValue | undefined
  onChange: (v: number) => void
}) {
  const min = field.min ?? 0
  const max = field.max ?? Infinity
  const n = value === undefined || value === '' ? null : Number(value)

  const button =
    'h-11 w-10 bg-surface text-xl text-ink transition hover:bg-surface-2 active:scale-[0.95] disabled:text-line-strong disabled:hover:bg-surface'

  return (
    <div
      role="group"
      aria-label={label}
      className="flex shrink-0 items-center overflow-hidden rounded-[10px] border border-line"
    >
      <button
        type="button"
        onClick={() => onChange(n === null ? min : Math.max(min, n - 1))}
        disabled={n !== null && n <= min}
        aria-label={`Decrease ${label}`}
        className={button}
      >
        −
      </button>
      <output
        aria-live="polite"
        data-testid="stepper-value"
        className={`w-[34px] text-center text-lg font-extrabold tabular-nums ${n === null ? 'text-muted' : 'text-ink'}`}
      >
        {n === null ? '–' : n}
      </output>
      <button
        type="button"
        onClick={() => onChange(n === null ? Math.min(min + 1, max) : Math.min(max, n + 1))}
        disabled={n !== null && n >= max}
        aria-label={`Increase ${label}`}
        className={button}
      >
        +
      </button>
    </div>
  )
}

/** Every scored round, one row each, with the round's best score in bold. */
function RoundHistory({
  players,
  rounds,
  direction,
  getHistoryInfo,
}: {
  players: ScoreboardRow[]
  rounds: number[]
  direction: ScoreDirection
  getHistoryInfo: (roundNumber: number) => RoundInfoChip[]
}) {
  return (
    <div
      id="round-history"
      data-testid="round-history"
      className="mt-1 overflow-x-auto rounded-[14px] border border-line bg-surface"
    >
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th scope="col" className="px-3 py-2 text-left font-semibold">
              Round
            </th>
            {players.map((p) => (
              <th key={p.player_id} scope="col" className="max-w-24 truncate px-2 py-2 text-right font-semibold">
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rounds.map((n) => {
            const scores = players.map((p) => p.scores[n - 1] ?? null)
            const present = scores.filter((s): s is number => s !== null)
            const best = present.length
              ? direction === 'low'
                ? Math.min(...present)
                : Math.max(...present)
              : null
            return (
              <tr key={n} className="border-b border-line last:border-b-0">
                <th scope="row" className="px-3 py-2 text-left font-semibold whitespace-nowrap text-muted">
                  R{n}
                  {getHistoryInfo(n).map((chip) => (
                    <span key={chip.key} title={chip.label} className={`ml-1 ${chipTone(chip)}`}>
                      {chip.value}
                    </span>
                  ))}
                </th>
                {scores.map((s, i) => (
                  <td
                    key={players[i].player_id}
                    className={`px-2 py-2 text-right ${s !== null && s === best ? 'font-extrabold text-ink' : 'text-muted'}`}
                  >
                    {s ?? '—'}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
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
    return (
      <label className="flex flex-wrap items-center gap-1.5 text-sm text-muted">
        <span>{field.label}</span>
        <select
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          aria-label={field.label}
          className="h-11 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:ring-2 focus:ring-accent-ink focus:outline-none"
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
        className="h-11 w-20 rounded-lg border border-line-strong bg-surface px-3 text-sm text-ink focus:ring-2 focus:ring-accent-ink focus:outline-none"
      />
    </label>
  )
}

function UndoIcon() {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 14L4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </svg>
  )
}

function TrophyIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4" />
      <path d="M12 13v4M9 20h6M10 17h4" />
    </svg>
  )
}
