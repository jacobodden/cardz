import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/dexie-db'
import { createSession, addPlayer as addPlayerToSession, startSession } from '../db/sessions'
import { getGame } from '../games'
import type { Game } from '../db/dexie-db'
import { getDefaultConfig } from '../games/types'
import FeltHero from '../components/FeltHero'
import CardTile from '../components/CardTile'

const INPUT =
  'h-12 w-full rounded-xl border border-line-strong bg-surface px-3.5 text-base text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent-ink'
const SECTION_HEADING = 'mb-2 text-[13px] font-bold text-muted'

function clamp(value: number, min?: number, max?: number): number {
  if (!Number.isFinite(value)) return min ?? 0
  return Math.min(max ?? Infinity, Math.max(min ?? -Infinity, Math.round(value)))
}

export default function NewSessionPage() {
  const navigate = useNavigate()
  const games = useLiveQuery(() => db.games.toArray(), [])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [title, setTitle] = useState('')
  // null = the user cleared the field; the suggested value is used instead.
  const [config, setConfig] = useState<Record<string, number | null>>({})
  const [playerNames, setPlayerNames] = useState<string[]>(['', ''])
  const [firstDealerIndex, setFirstDealerIndex] = useState(0)
  const [creating, setCreating] = useState(false)

  const validCount = playerNames.filter(Boolean).length
  const gameImpl = selectedGame ? getGame(selectedGame.slug) : undefined
  const usesDealer = gameImpl?.usesDealer ?? false
  const defaults = useMemo(
    () => (gameImpl ? getDefaultConfig(gameImpl, validCount) : {}),
    [gameImpl, validCount]
  )

  // Defaults we last filled in. A field still equal to its previous default
  // follows the player count; once the user edits it, it sticks.
  const lastDefaults = useRef<Record<string, number>>({})
  const prevGame = useRef<typeof gameImpl>(undefined)

  useEffect(() => {
    if (!gameImpl) return
    const prevDefaults = lastDefaults.current
    const switchedGame = prevGame.current !== gameImpl
    prevGame.current = gameImpl
    lastDefaults.current = defaults

    setConfig((prev) => {
      if (switchedGame) return defaults
      const next = { ...prev }
      for (const [key, value] of Object.entries(defaults)) {
        if (prev[key] === undefined || prev[key] === prevDefaults[key]) next[key] = value
      }
      return next
    })
  }, [gameImpl, defaults])

  function updateConfig(key: string, raw: string) {
    setConfig((prev) => ({ ...prev, [key]: raw === '' ? null : Number(raw) }))
  }

  function clampConfig(key: string) {
    const field = selectedGame?.config_schema.find((f) => f.key === key)
    const value = config[key]
    if (!field || value == null) return
    const clamped = clamp(value, field.min, field.max)
    if (clamped !== value) setConfig((prev) => ({ ...prev, [key]: clamped }))
  }

  /** Config to start with: cleared fields take the suggested value, all within range. */
  function resolvedConfig(): Record<string, number> {
    const resolved: Record<string, number> = {}
    for (const field of selectedGame?.config_schema ?? []) {
      const value = config[field.key] ?? defaults[field.key] ?? field.defaultValue
      resolved[field.key] = clamp(value, field.min, field.max)
    }
    return resolved
  }

  function addPlayer() {
    setPlayerNames([...playerNames, ''])
  }

  function removePlayer(i: number) {
    setPlayerNames(playerNames.filter((_, idx) => idx !== i))
  }

  function updatePlayer(i: number, name: string) {
    const next = [...playerNames]
    next[i] = name
    setPlayerNames(next)
  }

  async function handleStart() {
    if (!selectedGame) return
    setCreating(true)
    const sessionConfig = usesDealer
      ? { ...resolvedConfig(), first_dealer_index: firstDealerIndex }
      : resolvedConfig()

    const session = await createSession(selectedGame.id!, title || undefined)
    for (const name of playerNames.filter(Boolean)) {
      await addPlayerToSession(session.id, name)
    }
    await startSession(session.id, sessionConfig)
    navigate(`/sessions/${session.id}`)
  }

  const hero = (
    <FeltHero>
      <div className="mx-auto max-w-xl pt-1 pb-5">
        <h1 className="text-[32px] leading-tight font-extrabold tracking-tight">New game</h1>
        <p className="mt-0.5 text-sm text-on-felt/85">Pick a game, add players, and deal.</p>
      </div>
    </FeltHero>
  )

  if (!games)
    return (
      <>
        {hero}
        <p className="text-muted">Loading games...</p>
      </>
    )

  // Only games whose defaults depend on player count get a "calculated" hint.
  const playerCountDefaults = gameImpl?.getDefaultConfig && validCount >= 1 ? defaults : null
  const canStart =
    selectedGame &&
    validCount >= selectedGame.min_players &&
    validCount <= selectedGame.max_players
  const startHint =
    selectedGame && validCount < selectedGame.min_players
      ? `Add ${selectedGame.min_players - validCount} more player${selectedGame.min_players - validCount === 1 ? '' : 's'} to start`
      : null

  return (
    <div className="mx-auto max-w-xl">
      {hero}

      {/* Game selector */}
      <section aria-labelledby="pick-game" className="mb-6">
        <h2 id="pick-game" className={SECTION_HEADING}>
          Game
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {games.map((g) => {
            const selected = selectedGame?.id === g.id
            const face = getGame(g.slug)?.cardFace
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGame(g)}
                aria-pressed={selected}
                data-testid="game-option"
                data-game-slug={g.slug}
                className={`flex items-start gap-3 rounded-2xl border-2 p-3.5 text-left transition active:scale-[0.98] ${
                  selected ? 'border-accent-ink bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
                }`}
              >
                {face && <CardTile face={face} />}
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-base leading-snug font-bold text-ink">{g.name}</span>
                    {selected && <CheckIcon />}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{g.description}</span>
                  <span className="mt-1.5 block text-xs font-semibold text-muted">
                    {g.min_players}–{g.max_players} players
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </section>

      {selectedGame && (
        <>
          {/* Session title & game config */}
          <section className="mb-6 space-y-4">
            <div>
              <label htmlFor="session-title" className={`block ${SECTION_HEADING}`}>
                Title
              </label>
              <input
                id="session-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Friday Night Game"
                aria-label="Session Title"
                data-testid="session-title"
                className={INPUT}
              />
            </div>
            {selectedGame.config_schema.map((field) => {
              const autoValue = playerCountDefaults?.[field.key] ?? null
              const value = config[field.key]
              const suggested = autoValue ?? field.defaultValue
              const isManuallyEdited = autoValue !== null && value != null && value !== autoValue
              return (
                <div key={field.key}>
                  <label htmlFor={`config-${field.key}`} className={`block ${SECTION_HEADING}`}>
                    {field.label}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id={`config-${field.key}`}
                      type="number"
                      value={value ?? ''}
                      placeholder={String(suggested)}
                      onChange={(e) => updateConfig(field.key, e.target.value)}
                      onBlur={() => clampConfig(field.key)}
                      min={field.min}
                      max={field.max}
                      inputMode="numeric"
                      aria-label={field.label}
                      data-testid={`config-${field.key}`}
                      className={`${INPUT} w-24! text-center font-semibold tabular-nums`}
                    />
                    {autoValue !== null && (
                      <p className="text-[13px] text-muted">
                        {isManuallyEdited ? 'Suggested' : 'Calculated'}: {autoValue} for {validCount} player
                        {validCount > 1 ? 's' : ''}
                      </p>
                    )}
                    {autoValue === null && field.description && (
                      <p className="text-[13px] text-muted">{field.description}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </section>

          {/* Players */}
          <section aria-labelledby="players-heading" className="mb-6">
            <h2 id="players-heading" className={`flex justify-between ${SECTION_HEADING}`}>
              <span>Players</span>
              <span className="font-semibold tabular-nums">
                {validCount} of {selectedGame.min_players}–{selectedGame.max_players}
              </span>
            </h2>
            <div className="space-y-2">
              {playerNames.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold text-ink ${AVATAR_TONES[i % AVATAR_TONES.length]}`}
                  >
                    {i + 1}
                  </span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => updatePlayer(i, e.target.value)}
                    placeholder={`Player ${i + 1}`}
                    aria-label={`Player ${i + 1} name`}
                    data-testid="player-name-input"
                    className={`${INPUT} min-w-0 flex-1`}
                  />
                  {playerNames.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removePlayer(i)}
                      aria-label={`Remove player ${i + 1}`}
                      title="Remove player"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl text-danger transition hover:bg-no-bg active:scale-[0.95]"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {validCount < selectedGame.max_players && (
              <button
                type="button"
                onClick={addPlayer}
                data-testid="add-player"
                className="mt-2 h-11 w-full rounded-xl border border-dashed border-line-strong text-sm font-bold text-accent-ink transition hover:bg-accent-soft active:scale-[0.98]"
              >
                + Add player
              </button>
            )}
          </section>

          {usesDealer && validCount > 0 && (
            <section className="mb-6">
              <label htmlFor="first-dealer" className={`block ${SECTION_HEADING}`}>
                First dealer
              </label>
              <select
                id="first-dealer"
                value={firstDealerIndex}
                onChange={(e) => setFirstDealerIndex(Number(e.target.value))}
                aria-label="First Dealer"
                data-testid="first-dealer"
                className={INPUT}
              >
                {playerNames.map((name, i) => (
                  <option key={i} value={i}>
                    {name || `Player ${i + 1}`}
                  </option>
                ))}
              </select>
            </section>
          )}

          <div className="sticky bottom-0 z-10 -mx-4 mt-4 -mb-4 border-t border-line bg-page/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:-mb-6">
            {startHint && <p className="mb-2 text-center text-[13px] text-muted">{startHint}</p>}
            <button
              type="button"
              onClick={handleStart}
              disabled={!canStart || creating}
              data-testid="start-game"
              className="h-[52px] w-full rounded-[14px] bg-action text-[17px] font-extrabold text-on-action transition hover:opacity-90 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {creating ? 'Starting...' : `Start ${selectedGame.name}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

const AVATAR_TONES = ['bg-avatar-1', 'bg-avatar-2', 'bg-avatar-3']

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0 text-accent-ink">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}
