import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/dexie-db'
import { createSession, addPlayer as addPlayerToSession, startSession } from '../db/sessions'
import { getGame } from '../games'
import type { Game } from '../db/dexie-db'
import { getDefaultConfig } from '../games/types'

export default function NewSessionPage() {
  const navigate = useNavigate()
  const games = useLiveQuery(() => db.games.toArray(), [])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [title, setTitle] = useState('')
  const [config, setConfig] = useState<Record<string, number>>({})
  const [playerNames, setPlayerNames] = useState<string[]>(['', ''])
  const [firstDealerIndex, setFirstDealerIndex] = useState(0)
  const [creating, setCreating] = useState(false)
  const titleInput = useRef<HTMLInputElement>(null)

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

  function selectGame(g: Game) {
    // Render the title field now so we can focus it inside the tap handler:
    // iOS only opens the keyboard for focus() calls made during a user gesture.
    flushSync(() => setSelectedGame(g))
    const input = titleInput.current
    if (!input) return
    input.focus({ preventScroll: true })
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    input.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })
  }

  function updateConfig(key: string, value: number) {
    setConfig((prev) => ({ ...prev, [key]: value }))
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
      ? { ...config, first_dealer_index: firstDealerIndex }
      : { ...config }

    const session = await createSession(selectedGame.id!, title || undefined)
    for (const name of playerNames.filter(Boolean)) {
      await addPlayerToSession(session.id, name)
    }
    await startSession(session.id, sessionConfig)
    navigate(`/sessions/${session.id}`)
  }

  if (!games) return <p className="text-muted">Loading games...</p>

  // Only games whose defaults depend on player count get a "calculated" hint.
  const playerCountDefaults = gameImpl?.getDefaultConfig && validCount >= 1 ? defaults : null
  const canStart =
    selectedGame &&
    validCount >= selectedGame.min_players &&
    validCount <= selectedGame.max_players

  return (
    <div className="max-w-xl">
      <h1 className="text-2xl font-bold text-ink mb-6">New Game</h1>

      {/* Game selector */}
      <section className="mb-8">
        <h2 className="text-sm font-medium text-ink mb-3">Select Game</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {games.map((g) => (
            <button
              key={g.id}
              onClick={() => selectGame(g)}
              data-testid="game-option"
              data-game-slug={g.slug}
              className={`text-left p-5 rounded-lg border-2 transition active:scale-[0.98] ${
                selectedGame?.id === g.id
                  ? 'border-accent-ink bg-accent-soft'
                  : 'border-line bg-surface hover:border-line-strong'
              }`}
            >
              <h3 className="font-semibold text-ink">{g.name}</h3>
              <p className="text-sm text-muted mt-1">{g.description}</p>
              <p className="text-xs text-muted mt-2">
                {g.min_players}-{g.max_players} players
              </p>
            </button>
          ))}
        </div>
      </section>

      {selectedGame && (
        <>
          {/* Session title & game config */}
          <section className="mb-8 space-y-4">
            <div>
              <label className="text-sm font-medium text-ink block mb-1">
                Session Title
              </label>
              <input
                ref={titleInput}
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Friday Night Game"
                aria-label="Session Title"
                data-testid="session-title"
                className="w-full border border-line-strong rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-ink bg-surface text-ink"
              />
            </div>
            {selectedGame.config_schema.map((field) => {
              const autoValue = playerCountDefaults?.[field.key] ?? null
              const isManuallyEdited = autoValue !== null && config[field.key] !== autoValue
              return (
                <div key={field.key}>
                  <label className="text-sm font-medium text-ink block mb-1">
                    {field.label}
                  </label>
                  <input
                    type="number"
                    value={config[field.key] ?? field.defaultValue}
                    onChange={(e) => updateConfig(field.key, Number(e.target.value))}
                    min={field.min}
                    max={field.max}
                    inputMode="numeric"
                    aria-label={field.label}
                    data-testid={`config-${field.key}`}
                    className="w-full sm:w-24 border border-line-strong rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-ink bg-surface text-ink"
                  />
                  {autoValue !== null && (
                    <p className="text-xs text-muted mt-1">
                      {isManuallyEdited ? 'Suggested' : 'Calculated'}: {autoValue} for {validCount} player{validCount > 1 ? 's' : ''}
                    </p>
                  )}
                  {autoValue === null && field.description && (
                    <p className="text-xs text-muted mt-1">{field.description}</p>
                  )}
                </div>
              )
            })}
          </section>

          {/* Players */}
          <section className="mb-8">
            <h2 className="text-sm font-medium text-ink mb-3">
              Players ({validCount}/{selectedGame.min_players}–{selectedGame.max_players})
            </h2>
            <div className="space-y-2">
              {playerNames.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm text-muted w-6 shrink-0">{i + 1}.</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => updatePlayer(i, e.target.value)}
                    placeholder={`Player ${i + 1}`}
                    aria-label={`Player ${i + 1} name`}
                    data-testid="player-name-input"
                    className="flex-1 border border-line-strong rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-ink bg-surface text-ink"
                  />
                  {playerNames.length > 2 && (
                    <button
                      onClick={() => removePlayer(i)}
                      className="w-10 h-10 flex items-center justify-center text-danger hover:opacity-80 text-xl rounded-lg hover:bg-no-bg transition active:scale-[0.95]"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            {validCount < selectedGame.max_players && (
              <button
                onClick={addPlayer}
                data-testid="add-player"
                className="mt-2 w-full sm:w-auto text-sm text-accent-ink hover:opacity-80 py-2.5 px-4 rounded-lg hover:bg-accent-soft transition active:scale-[0.98]"
              >
                + Add player
              </button>
            )}
          </section>

          {usesDealer && validCount > 0 && (
            <section className="mb-8">
              <label className="text-sm font-medium text-ink block mb-1">
                First Dealer
              </label>
              <select
                value={firstDealerIndex}
                onChange={(e) => setFirstDealerIndex(Number(e.target.value))}
                aria-label="First Dealer"
                data-testid="first-dealer"
                className="w-full sm:w-auto border border-line-strong rounded px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent-ink bg-surface text-ink"
              >
                {playerNames.map((name, i) => (
                  <option key={i} value={i}>
                    {name || `Player ${i + 1}`}
                  </option>
                ))}
              </select>
            </section>
          )}

          <button
            onClick={handleStart}
            disabled={!canStart || creating}
            data-testid="start-game"
            className="w-full sm:w-auto bg-accent text-on-accent px-6 py-3 rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium active:scale-[0.98] transition"
          >
            {creating ? 'Starting...' : 'Start Game'}
          </button>
        </>
      )}
    </div>
  )
}
