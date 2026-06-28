export async function getFireworks() {
  const res = await fetch('/api/fireworks')
  if (!res.ok) throw new Error(`GET /api/fireworks failed: ${res.status}`)
  return res.json()
}

export async function uploadFirework({ file, name, durationSec }) {
  const form = new FormData()
  form.append('video', file)
  form.append('name', name)
  form.append('duration_sec', String(durationSec))

  const res = await fetch('/api/fireworks', { method: 'POST', body: form })
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}))
    throw new Error(msg.error || `Upload failed: ${res.status}`)
  }
  return res.json()
}

export async function deleteFirework(id) {
  const res = await fetch(`/api/fireworks/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`)
}

export async function uploadShowAudio(file) {
  const form = new FormData()
  form.append('audio', file)
  const res = await fetch('/api/audio', { method: 'POST', body: form })
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}))
    throw new Error(msg.error || `Audio upload failed: ${res.status}`)
  }
  return res.json()
}

export async function getShowAudio() {
  const res = await fetch('/api/audio')
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`GET /api/audio failed: ${res.status}`)
  return res.json()
}

export function isPersistedAudioUrl(url) {
  return typeof url === 'string' && url.startsWith('/uploads/show-audio.')
}

export async function updateVideoTrim(inventoryId, { trim_start, trim_end }) {
  const res = await fetch(`/api/inventory/videos/${inventoryId}/trim`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trim_start, trim_end }),
  })
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}))
    throw new Error(msg.error || `Trim save failed: ${res.status}`)
  }
  return res.json()
}

// Reads the playback duration (seconds) from a local video File via metadata.
export function readVideoDuration(file) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      const d = video.duration
      resolve(Number.isFinite(d) && d > 0 ? Math.round(d) : 0)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(0)
    }
    video.src = url
  })
}
