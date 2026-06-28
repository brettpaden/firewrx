import { useEffect, useRef, useState } from 'react'
import { getFireworkTrimRange } from './trim.js'

const MAX_FRAMES = 160
const CANVAS_H = 96
const SEEK_TIMEOUT_MS = 4000

const tsKey = (t) => t.toFixed(2)

function once(el, event, timeout = SEEK_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      el.removeEventListener(event, onEvent)
      clearTimeout(timer)
    }
    const onEvent = () => {
      cleanup()
      resolve()
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(`timeout waiting for ${event}`))
    }, timeout)
    el.addEventListener(event, onEvent, { once: true })
  })
}

// Pass `firework` to sample only the trimmed in/out range on the source file.
// Pass `fullDuration` to sample the entire file (trim editor).
export function useFilmstrip(videoUrl, numFrames, { firework, fullDuration } = {}) {
  const count = Math.max(1, Math.min(MAX_FRAMES, Math.round(numFrames) || 1))
  const [frames, setFrames] = useState([])

  const { trimStart, trimEnd } =
    firework != null
      ? getFireworkTrimRange(firework)
      : { trimStart: 0, trimEnd: fullDuration || 1 }
  const rangeStart = trimStart
  const rangeEnd = trimEnd
  const rangeLen = Math.max(0.01, rangeEnd - rangeStart)

  const videoRef = useRef(null)
  const cacheRef = useRef(new Map())
  const tokenRef = useRef(0)

  useEffect(() => {
    cacheRef.current = new Map()
    setFrames([])
    if (!videoUrl) return undefined

    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.src = videoUrl
    videoRef.current = video

    return () => {
      tokenRef.current++
      video.removeAttribute('src')
      video.load()
      videoRef.current = null
    }
  }, [videoUrl])

  useEffect(() => {
    if (!videoUrl) return undefined
    const handle = setTimeout(run, 120)
    return () => clearTimeout(handle)

    async function run() {
      const video = videoRef.current
      if (!video) return
      const token = ++tokenRef.current
      const cache = cacheRef.current

      try {
        if (video.readyState < 1) await once(video, 'loadedmetadata')
      } catch {
        return
      }
      if (token !== tokenRef.current) return

      const total =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : rangeEnd

      const timestamps = Array.from({ length: count }, (_, i) =>
        Math.min(total - 0.01, rangeStart + (rangeLen * (i + 0.5)) / count),
      )

      setFrames(timestamps.map((t) => cache.get(tsKey(t)) ?? null))

      const w = video.videoWidth || 160
      const h = video.videoHeight || 90
      const canvas = document.createElement('canvas')
      canvas.height = CANVAS_H
      canvas.width = Math.round((w / h) * CANVAS_H)
      const ctx = canvas.getContext('2d')

      for (const t of timestamps) {
        if (token !== tokenRef.current) return
        const key = tsKey(t)
        if (cache.has(key)) continue
        try {
          video.currentTime = t
          await once(video, 'seeked')
          if (token !== tokenRef.current) return
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
          cache.set(key, canvas.toDataURL('image/jpeg', 0.7))
          setFrames(timestamps.map((ts) => cache.get(tsKey(ts)) ?? null))
        } catch {
          // skip failed frame
        }
      }
    }
  }, [videoUrl, rangeStart, rangeEnd, rangeLen, count])

  return frames
}
