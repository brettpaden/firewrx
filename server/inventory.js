import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const inventoryPath = join(__dirname, '..', 'inventory.json')

function inferType(productName) {
  const n = productName.toLowerCase()
  if (n.includes('shell')) return 'shell'
  if (n.includes('comet') || n.includes('flare')) return 'flare'
  if (n.includes('finale')) return 'finale'
  if (n.includes('cake') || n.includes('compound')) return 'cake'
  return 'cake'
}

function roundDuration(sec) {
  return Math.max(1, Math.round(sec))
}

// Each receipt line for bulk shell packs counts as 6 individual shells in inventory.
const BULK_SHELLS_PACK = /^Bulk Shells - (5|6)\b/
const BULK_SHELL = /^Bulk Shells\b/

function inventoryQuantity(item) {
  if (item.inventory_count != null) return Math.max(0, item.inventory_count)
  const lineQty = Math.max(1, item.quantity ?? 1)
  if (BULK_SHELLS_PACK.test(item.product_name)) return lineQty * 6
  return lineQty
}

function itemDurationSec(name, hasVideo, trimStart, trimEnd) {
  if (BULK_SHELL.test(name)) return 4
  if (hasVideo && trimEnd != null) return roundDuration(trimEnd - (trimStart ?? 0))
  return 10
}

let cached = null

export function clearInventoryCache() {
  cached = null
}

export function updateVideoTrim(inventoryId, trimStart, trimEnd) {
  const raw = JSON.parse(readFileSync(inventoryPath, 'utf8'))
  const video = (raw.videos ?? []).find((v) => v.inventory_id === Number(inventoryId))
  if (!video) throw new Error('Video not found for this inventory item')

  const start = Math.max(0, Number(trimStart) || 0)
  const end = Math.max(start + 0.5, Number(trimEnd) || start + 1)
  video.trim_start = Math.round(start * 100) / 100
  video.trim_end = Math.round(end * 100) / 100

  writeFileSync(inventoryPath, `${JSON.stringify(raw, null, 2)}\n`)
  clearInventoryCache()

  return {
    trim_start: video.trim_start,
    trim_end: video.trim_end,
    duration_sec: roundDuration(video.trim_end - video.trim_start),
  }
}

export function loadInventoryFireworks() {
  if (cached) return cached

  const raw = JSON.parse(readFileSync(inventoryPath, 'utf8'))
  const videoByInventoryId = new Map(
    (raw.videos ?? []).map((v) => [v.inventory_id, v]),
  )

  const byName = new Map()
  for (const item of raw.inventory ?? []) {
    if (item.exclude_from_inventory) continue

    const name = item.product_name
    const qty = inventoryQuantity(item)
    const existing = byName.get(name)
    if (existing) {
      existing.quantity += qty
      continue
    }

    const video = videoByInventoryId.get(item.id)
    const hasVideo = !!video?.video_file && !video.source_missing
    const trimStart = hasVideo ? (video.trim_start ?? 0) : null
    const trimEnd = hasVideo ? (video.trim_end ?? null) : null
    const durationSec = itemDurationSec(name, hasVideo, trimStart, trimEnd)

    byName.set(name, {
      id: item.id,
      name,
      quantity: qty,
      type: inferType(name),
      duration_sec: durationSec,
      video_url: hasVideo ? `/${video.video_file.replace(/^\//, '')}` : null,
      trim_start: trimStart,
      trim_end: trimEnd,
      thumbnail: item.thumbnail ?? null,
      matched: !!item.matched,
      source: 'inventory',
    })
  }

  cached = Array.from(byName.values())
  return cached
}

// Merge fireworks that share a name, summing quantity (inventory + uploads).
export function condenseFireworks(items) {
  const byName = new Map()
  for (const item of items) {
    const qty = Math.max(1, item.quantity ?? 1)
    const existing = byName.get(item.name)
    if (existing) {
      existing.quantity += qty
      if (!existing.video_url && item.video_url) {
        existing.type = item.type
        existing.duration_sec = item.duration_sec
        existing.video_url = item.video_url
        existing.trim_start = item.trim_start ?? null
        existing.trim_end = item.trim_end ?? null
      }
      continue
    }
    byName.set(item.name, { ...item, quantity: qty })
  }
  return Array.from(byName.values())
}
