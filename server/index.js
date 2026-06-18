import express from 'express'
import cors from 'cors'
import { db } from './db.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/fireworks', (_req, res) => {
  const rows = db.prepare('SELECT * FROM fireworks ORDER BY id').all()
  res.json(rows)
})

const PORT = 3041
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
})
