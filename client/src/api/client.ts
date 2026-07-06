const BASE = '/api'

export type ScoreDataValue = number | string

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status} ${res.statusText}: ${body}`)
  }
  return res.json()
}

export interface ConfigField {
  key: string
  label: string
  type: 'number'
  defaultValue: number
  min?: number
  max?: number
  description?: string
}

export interface Game {
  id: number
  slug: string
  name: string
  description: string
  min_players: number
  max_players: number
  config_schema: ConfigField[]
}

export interface Player {
  id: number
  session_id: number
  name: string
  order_index: number
}

export interface InputField {
  key: string
  label: string
  type: 'number' | 'select'
  options?: string[]
  min?: number
  max?: number
  scope?: 'round' | 'player'
}

export interface CurrentRound {
  round_number: number
  data_json: string | null
  fields: InputField[]
  complete?: boolean
}

export interface ScoreEntry {
  player_id: number
  score: number
  data_json: string | null
}

export interface Session {
  id: number
  game_id: number
  title: string | null
  status: string
  created_at: string
  game?: Game
  players?: Player[]
  total_rounds?: number
}

export interface ScoreboardRow {
  player_id: number
  name: string
  scores: (number | null)[]
  total: number
}

export interface RoundMetaInfo {
  round_number: number
  data_json: string
}

export interface ScoreboardResponse {
  players: ScoreboardRow[]
  rounds_meta: RoundMetaInfo[]
}

export const api = {
  listGames: () => request<Game[]>('/games'),

  listSessions: () => request<Session[]>('/sessions'),

  createSession: (data: { game_id: number; title?: string; config?: any }) =>
    request<Session>('/sessions', { method: 'POST', body: JSON.stringify(data) }),

  getSession: (id: number) => request<Session>(`/sessions/${id}`),

  addPlayer: (sessionId: number, name: string) =>
    request<Player>(`/sessions/${sessionId}/players`, {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  removePlayer: (sessionId: number, playerId: number) =>
    request<void>(`/sessions/${sessionId}/players/${playerId}`, {
      method: 'DELETE',
    }),

  startSession: (sessionId: number, config?: any) =>
    request<Session>(`/sessions/${sessionId}/start`, {
      method: 'POST',
      body: JSON.stringify({ config }),
    }),

  getCurrentRound: (sessionId: number) =>
    request<CurrentRound>(`/sessions/${sessionId}/rounds`),

  submitRound: (
    sessionId: number,
    roundData: { round_data?: Record<string, any>; scores: { player_id: number; data: Record<string, ScoreDataValue> }[] }
  ) =>
    request<{ scores: ScoreEntry[]; complete: boolean }>(`/sessions/${sessionId}/rounds`, {
      method: 'POST',
      body: JSON.stringify(roundData),
    }),

  getScoreboard: (sessionId: number) =>
    request<ScoreboardResponse>(`/sessions/${sessionId}/scoreboard`),
}
