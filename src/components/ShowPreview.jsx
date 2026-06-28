import { useEffect, useMemo, useRef } from 'react'
import { useShowStore } from '../store/useShowStore.js'
import { clipSourceTime, isClipActiveAt } from '../trim.js'

const fmt = (t) => {
  const m = Math.floor(t / 60)
  const s = String(Math.floor(t % 60)).padStart(2, '0')
  return `${m}:${s}`
}

function layerOpacity(activeCount) {
  if (activeCount <= 1) return 1
  return Math.min(0.65, 0.9 / activeCount)
}

export default function ShowPreview({ wsRef, onClose }) {
  const clips = useShowStore((s) => s.clips)
  const currentTime = useShowStore((s) => s.currentTime)
  const duration = useShowStore((s) => s.duration)
  const isPlaying = useShowStore((s) => s.isPlaying)

  const videoClips = useMemo(
    () => clips.filter((c) => c.firework.video_url),
    [clips],
  )

  const videoRefs = useRef(new Map())

  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return undefined
    ws.play().catch(() => {})
    return () => {
      ws.pause()
    }
  }, [wsRef])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const t = wsRef.current?.getCurrentTime() ?? useShowStore.getState().currentTime
      const activeClips = videoClips.filter((clip) => isClipActiveAt(clip, t))
      const opacity = layerOpacity(activeClips.length)

      for (const clip of videoClips) {
        const el = videoRefs.current.get(clip.id)
        if (!el) continue

        const active = isClipActiveAt(clip, t)
        const target = clipSourceTime(clip, t)
        el.style.opacity = active ? String(opacity) : '0'

        if (!active || target == null) {
          el.pause()
          continue
        }

        if (Math.abs(el.currentTime - target) > 0.12) {
          el.currentTime = target
        }

        if (useShowStore.getState().isPlaying && el.paused) {
          el.play().catch(() => {})
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [videoClips, wsRef])

  useEffect(() => {
    if (isPlaying) return
    for (const clip of videoClips) {
      videoRefs.current.get(clip.id)?.pause()
    }
  }, [isPlaying, videoClips])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const togglePlay = () => {
    wsRef.current?.playPause()
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 200,
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(960px, 100%)',
          background: 'var(--panel)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <strong style={{ fontSize: 14 }}>Preview Show</strong>
          <button onClick={togglePlay} style={{ minWidth: 72 }}>
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <span style={{ fontSize: 13, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>
          <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 'auto' }}>
            {videoClips.length} video{videoClips.length === 1 ? '' : 's'} layered
          </span>
          <button onClick={onClose}>Close</button>
        </div>

        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: '16 / 9',
            background: '#000',
          }}
        >
          {videoClips.length === 0 ? (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--muted)',
                fontSize: 14,
              }}
            >
              No video clips on the timeline.
            </div>
          ) : (
            videoClips.map((clip, index) => (
              <video
                key={clip.id}
                ref={(el) => {
                  if (el) videoRefs.current.set(clip.id, el)
                  else videoRefs.current.delete(clip.id)
                }}
                src={clip.firework.video_url}
                muted
                playsInline
                preload="auto"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  opacity: 0,
                  zIndex: index + 1,
                  pointerEvents: 'none',
                  transition: 'opacity 0.15s ease',
                }}
              />
            ))
          )}
        </div>

        <p style={{ margin: 0, padding: '10px 16px', fontSize: 12, color: 'var(--muted)' }}>
          Active clips are composited with transparency so overlapping fireworks stay visible.
        </p>
      </div>
    </div>
  )
}
