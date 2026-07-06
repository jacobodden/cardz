import { Router } from 'express'
import { getDb } from '../db/schema.js'
import { getGame } from '../games/index.js'

const router = Router()

router.get('/', (_req, res) => {
  const db = getDb()
  const rows = db.prepare('SELECT * FROM games ORDER BY name').all() as any[]
  const games = rows.map((row) => {
    const impl = getGame(row.slug)
    return {
      ...row,
      config_schema: impl?.getConfigSchema() ?? [],
    }
  })
  res.json(games)
})

export default router
