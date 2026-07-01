import { useShowStore } from './store/useShowStore.js'

// wavesurfer (its media element) is the SINGLE source of truth for playback time.
// We only mirror its time/playing state into the store so the DOM overlay playhead
// (over the clip tracks) and the cue-flash logic can read it. Seeks go straight to
// wavesurfer via setTime() and come back as 'timeupdate' — no RAF, no gating.
//
// MISSION-CRITICAL: clicking the waveform uses wavesurfer's NATIVE interaction, which
// maps the click to time in the waveform's own coordinate space. Nothing here may
// re-derive or second-guess that position. (Accurate *seeking* additionally requires
// constant-bitrate audio — VBR MP3s seek imprecisely; see the upload pipeline.)

export function seekToTime(ws, time) {
  if (!Number.isFinite(time)) return 0
  const dur = ws?.getDuration?.() || useShowStore.getState().duration || 0
  const clamped = dur > 0 ? Math.max(0, Math.min(time, dur)) : Math.max(0, time)

  if (ws && dur > 0) {
    // Emits 'timeupdate' (even while paused) → the bridge updates the store.
    ws.setTime(clamped)
  } else {
    // No audio loaded yet: move the overlay directly so the UI still responds.
    useShowStore.getState().setCurrentTime(clamped)
  }

  return clamped
}

export function wireAudioClock(ws, { setCurrentTime, setIsPlaying }) {
  // Fires ~every 16ms while playing AND once on every setTime()/native seek.
  const offTime = ws.on('timeupdate', (t) => {
    if (Number.isFinite(t)) setCurrentTime(t)
  })
  const offPlay = ws.on('play', () => setIsPlaying(true))
  const offPause = ws.on('pause', () => setIsPlaying(false))
  const offFinish = ws.on('finish', () => setIsPlaying(false))

  return () => {
    offTime()
    offPlay()
    offPause()
    offFinish()
  }
}
