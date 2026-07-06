import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import gamesRouter from './routes/games.js'
import sessionsRouter from './routes/sessions.js'
import { getDb, closeDb } from './db/schema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// API routes
app.use('/api/games', gamesRouter)
app.use('/api/sessions', sessionsRouter)

// Serve built client in production
const clientDist = path.resolve(__dirname, '..', '..', 'client', 'dist')

// Serve static files and catch-all for SPA routing
app.use(express.static(clientDist))
app.use((_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'))
})

// Initialize DB on startup
getDb()

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

function shutdown() {
  closeDb()
  server.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
