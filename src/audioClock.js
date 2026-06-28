import { useShowStore } from './store/useShowStore.js'

// While a user-initiated seek is in flight, ignore media clock reads that still
// reflect the pre-seek playback position. Without this, RAF / seeking events can
// snap the playhead back ~1s while audio correctly jumps to the click target.
let pendingSeek = null
let seekFallbackTimer = null

export function beginSeek(target) {
  pendingSeek = target
  clearTimeout(seekFallbackTimer)
  seekFallbackTimer = setTimeout(() => {
    pendingSeek = null
  }, 800)
}

export function clearSeek() {
  pendingSeek = null
  clearTimeout(seekFallbackTimer)
  seekFallbackTimer = null
}

function shouldApplyTime(t) {
  if (pendingSeek == null) return true
  if (Math.abs(t - pendingSeek) < 0.2) {
    clearSeek()
    return true
  }
  return false
}

export function seekToTime(ws, time) {
  if (!Number.isFinite(time)) return 0
  const dur = ws?.getDuration?.() || useShowStore.getState().duration || 0
  const clamped = dur > 0 ? Math.max(0, Math.min(time, dur)) : Math.max(0, time)

  beginSeek(clamped)
  useShowStore.getState().setCurrentTime(clamped)

  if (ws && dur > 0) {
    ws.setTime(clamped)
  }

  return clamped
}

export function wireAudioClock(ws, { setCurrentTime, setIsPlaying }) {
  const media = ws.getMediaElement()
  let rafId = 0

  const pushTime = (t, force = false) => {
    if (!Number.isFinite(t)) return
    if (!force && !shouldApplyTime(t)) return
    setCurrentTime(t)
  }

  const syncFromMedia = (force = false) => {
    if (!media) return
    if (!force && media.seeking) return
    pushTime(media.currentTime, force)
  }

  const tick = () => {
    syncFromMedia()
    rafId = requestAnimationFrame(tick)
  }

  ws.on('ready', () => syncFromMedia(true))

  // wavesurfer timeupdate can report stale positions during seeks — ignore it.
  ws.on('timeupdate', () => {})

  // seeking fires with the *old* currentTime in many browsers — never sync from it.
  ws.on('seeking', () => {})

  ws.on('play', () => {
    setIsPlaying(true)
    cancelAnimationFrame(rafId)
    rafId = requestAnimationFrame(tick)
  })

  ws.on('pause', () => {
    setIsPlaying(false)
    cancelAnimationFrame(rafId)
    syncFromMedia(true)
  })

  ws.on('finish', () => {
    setIsPlaying(false)
    cancelAnimationFrame(rafId)
  })

  const onSeeked = () => {
    clearSeek()
    syncFromMedia(true)
  }

  media?.addEventListener('seeked', onSeeked)

  return () => {
    cancelAnimationFrame(rafId)
    media?.removeEventListener('seeked', onSeeked)
    clearSeek()
  }
}
