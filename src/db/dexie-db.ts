import Dexie, { type EntityTable } from 'dexie'
import type { ConfigField } from '../games/types'
import { seedGames } from './seed'

export interface Game {
  id?: number
  slug: string
  name: string
  description: string
  min_players: number
  max_players: number
  config_schema: ConfigField[]
}

export interface Session {
  id?: number
  game_id: number
  title: string | null
  status: 'active' | 'completed'
  config_json: Record<string, any>
  created_at: string
}

export interface Player {
  id?: number
  session_id: number
  name: string
  order_index: number
}

export interface Round {
  id?: number
  session_id: number
  round_number: number
  data_json: Record<string, any>
}

export interface Score {
  id?: number
  round_id: number
  player_id: number
  score: number
  data_json: Record<string, any>
}

export class CardzDB extends Dexie {
  games!: EntityTable<Game, 'id'>
  sessions!: EntityTable<Session, 'id'>
  players!: EntityTable<Player, 'id'>
  rounds!: EntityTable<Round, 'id'>
  scores!: EntityTable<Score, 'id'>

  constructor() {
    super('cardz')
    this.version(1).stores({
      games: '++id, &slug, name, description, min_players, max_players, config_schema',
      sessions: '++id, game_id, title, status, config_json, created_at',
      players: '++id, session_id, name, order_index',
      rounds: '++id, session_id, round_number, data_json',
      scores: '++id, round_id, player_id, score, data_json',
    })
  }
}

export const db = new CardzDB()

seedGames(db)
