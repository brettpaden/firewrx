import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { fileURLToPath } from 'node:url'
import { dirname, join, extname } from 'node:path'
import { mkdirSync, existsSync, unlinkSync, readdirSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { db } from './db.js'
import { loadInventoryFireworks, condenseFireworks, updateVideoTrim } from './inventory.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')
const uploadsDir = join(rootDir, 'uploads')
const videosDir = join(rootDir, 'videos')
mkdirSync(uploadsDir, { recursive: true })

const app = express()
app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(uploadsDir))
app.use('/videos', express.static(videosDir))

// Store uploads on disk with a collision-proof name; keep the original extension.
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname) || '.mp4'}`),
})
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === 'video/mp4' || extname(file.originalname).toLowerCase() === '.mp4'
    cb(ok ? null : new Error('Only .mp4 videos are allowed'), ok)
  },
})

const audioStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase() || '.mp3'
    cb(null, `show-audio${ext}`)
  },
})
const audioUpload = multer({
  storage: audioStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = extname(file.originalname).toLowerCase()
    const ok =
      file.mimetype.startsWith('audio/') ||
      ext === '.mp3' ||
      ext === '.m4a' ||
      ext === '.wav'
    cb(ok ? null : new Error('Only audio files are allowed'), ok)
  },
})

const findShowAudioUrl = () => {
  const name = readdirSync(uploadsDir).find((f) => f.startsWith('show-audio.'))
  return name ? `/uploads/${name}` : null
}

app.get('/api/fireworks', (_req, res) => {
  const inventory = loadInventoryFireworks()
  const uploads = db
    .prepare('SELECT * FROM fireworks WHERE video_url LIKE ? ORDER BY id')
    .all('/uploads/%')
    .map((row) => ({ ...row, source: 'upload', quantity: 1 }))
  res.json(condenseFireworks([...inventory, ...uploads]))
})

app.get('/api/audio', (_req, res) => {
  const url = findShowAudioUrl()
  if (!url) return res.status(404).json({ error: 'No show audio uploaded' })
  res.json({ url })
})

app.post('/api/audio', audioUpload.single('audio'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No audio file uploaded' })

  const kept = req.file.filename
  for (const f of readdirSync(uploadsDir)) {
    if (f.startsWith('show-audio.') && f !== kept) {
      try {
        unlinkSync(join(uploadsDir, f))
      } catch {
        // ignore
      }
    }
  }

  res.json({ url: `/uploads/${kept}` })
})

app.patch('/api/inventory/videos/:inventoryId/trim', (req, res) => {
  const { trim_start, trim_end } = req.body ?? {}
  if (trim_start == null || trim_end == null) {
    return res.status(400).json({ error: 'trim_start and trim_end are required' })
  }
  try {
    const updated = updateVideoTrim(req.params.inventoryId, trim_start, trim_end)
    res.json(updated)
  } catch (err) {
    res.status(404).json({ error: err.message })
  }
})

// Create an inventory item from an uploaded mp4. `name` and `duration_sec` come
// from the client (filename is editable on upload; duration is read off the video).
app.post('/api/fireworks', upload.single('video'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video file uploaded' })

  const name = (req.body.name || '').trim() || req.file.originalname.replace(/\.[^.]+$/, '')
  const duration = Math.max(1, Math.round(Number(req.body.duration_sec) || 0))
  const videoUrl = `/uploads/${req.file.filename}`

  const info = db
    .prepare('INSERT INTO fireworks (name, type, duration_sec, video_url) VALUES (?, ?, ?, ?)')
    .run(name, 'video', duration, videoUrl)
  const row = db.prepare('SELECT * FROM fireworks WHERE id = ?').get(info.lastInsertRowid)
  res.status(201).json({ ...row, source: 'upload', quantity: 1 })
})

app.delete('/api/fireworks/:id', (req, res) => {
  const inventoryIds = new Set(loadInventoryFireworks().map((fw) => fw.id))
  if (inventoryIds.has(Number(req.params.id))) {
    return res.status(403).json({ error: 'Cannot delete inventory items from the show order' })
  }

  const row = db.prepare('SELECT * FROM fireworks WHERE id = ?').get(req.params.id)
  if (!row) return res.status(404).json({ error: 'Not found' })

  // Remove the backing file for locally-uploaded videos.
  if (row.video_url?.startsWith('/uploads/')) {
    const filePath = join(uploadsDir, row.video_url.slice('/uploads/'.length))
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath)
      } catch {
        // Non-fatal: DB row is still removed below.
      }
    }
  }

  db.prepare('DELETE FROM fireworks WHERE id = ?').run(req.params.id)
  res.status(204).end()
})

// Surface multer/file-filter errors as JSON instead of an HTML stack trace.
app.use((err, _req, res, _next) => {
  res.status(400).json({ error: err.message || 'Upload failed' })
})

const PORT = 3041
app.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
})
