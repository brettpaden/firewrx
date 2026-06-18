import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, '..', 'data')
mkdirSync(dataDir, { recursive: true })

export const db = new Database(join(dataDir, 'firewrx.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS fireworks (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL,
    type         TEXT    NOT NULL,
    duration_sec INTEGER NOT NULL,
    video_url    TEXT
  );
`)

const TYPES = ['cake', 'shell', 'finale', 'flare']
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

// Seed 10 fireworks once, on an empty table.
const count = db.prepare('SELECT COUNT(*) AS n FROM fireworks').get().n
if (count === 0) {
  const insert = db.prepare(
    'INSERT INTO fireworks (name, type, duration_sec, video_url) VALUES (?, ?, ?, ?)',
  )
  const seed = db.transaction(() => {
    for (let i = 1; i <= 10; i++) {
      const type = TYPES[randInt(0, TYPES.length - 1)]
      insert.run(`${type[0].toUpperCase()}${type.slice(1)} ${i}`, type, randInt(20, 120), null)
    }
  })
  seed()
  console.log('[db] seeded 10 fireworks')
}
