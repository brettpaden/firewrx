import { useEffect, useRef } from 'react'
import { useShowStore } from './store/useShowStore.js'

// Detect playhead crossings into clips and trigger cue flashes. Centralized here so
// replay / stop / seek reliably re-arm detection (per-clip refs only fired once).
export function useClipCueFlashes() {
  const clips = useShowStore((s) => s.clips)
  const currentTime = useShowStore((s) => s.currentTime)
  const isPlaying = useShowStore((s) => s.isPlaying)
  const flashClip = useShowStore((s) => s.flashClip)

  const prevTimeRef = useRef(currentTime)
  const wasPlayingRef = useRef(isPlaying)

  useEffect(() => {
    let prev = prevTimeRef.current
    const now = currentTime
    const justStarted = isPlaying && !wasPlayingRef.current
    wasPlayingRef.current = isPlaying

    // Rewind, stop, or replay — treat the prior position as before any clip.
    if (now < prev - 0.05 || (justStarted && now < 0.25)) {
      prev = now - 0.001
    }

    for (const clip of clips) {
      const start = clip.startSec
      const end = start + clip.firework.duration_sec
      const inside = now >= start && now < end
      const crossedIn = inside && (prev < start || prev >= end)
      const startedAtHead = justStarted && inside && now - start < 0.15
      if (crossedIn || startedAtHead) flashClip(clip.id)
    }

    prevTimeRef.current = now
  }, [currentTime, isPlaying, clips, flashClip])
}
