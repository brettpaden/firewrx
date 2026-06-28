import { useCallback, useEffect, useRef, useState } from 'react'
import { updateVideoTrim } from '../api.js'
import { useFilmstrip } from '../filmstrip.js'

const MIN_TRIM_SEC = 0.5
const fmt = (t) => {
  const m = Math.floor(t / 60)
  const s = (t % 60).toFixed(2).padStart(5, '0')
  return `${m}:${s}`
}

export default function VideoTrimModal({ firework, onClose, onSaved }) {
  const videoRef = useRef(null)
  const trackRef = useRef(null)

  const [fullDuration, setFullDuration] = useState(0)
  const [trimStart, setTrimStart] = useState(firework.trim_start ?? 0)
  const [trimEnd, setTrimEnd] = useState(
    firework.trim_end ?? (firework.trim_start ?? 0) + firework.duration_sec,
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [scrubbing, setScrubbing] = useState(null) // 'start' | 'end' while dragging a handle

  const frames = useFilmstrip(firework.video_url, 18, { fullDuration })

  const seekPreviewFrame = useCallback((side, start, end) => {
    const v = videoRef.current
    if (!v) return
    v.pause()
    const t = side === 'start' ? start : Math.max(start, end - 0.04)
    if (Math.abs(v.currentTime - t) > 0.02) v.currentTime = t
  }, [])

  const clampRange = useCallback(
    (start, end) => {
      if (!fullDuration) return { start: 0, end: MIN_TRIM_SEC }
      let s = Math.max(0, start)
      let e = Math.min(fullDuration, end)
      if (e - s < MIN_TRIM_SEC) {
        if (s + MIN_TRIM_SEC <= fullDuration) e = s + MIN_TRIM_SEC
        else s = Math.max(0, e - MIN_TRIM_SEC)
      }
      return { start: s, end: e }
    },
    [fullDuration],
  )

  const onVideoMeta = () => {
    const d = videoRef.current?.duration
    if (!Number.isFinite(d) || d <= 0) return
    const s = Math.min(firework.trim_start ?? 0, d - MIN_TRIM_SEC)
    const e = Math.min(firework.trim_end ?? s + firework.duration_sec, d)
    const start = Math.max(0, s)
    const end = Math.max(start + MIN_TRIM_SEC, e)
    setFullDuration(d)
    setTrimStart(start)
    setTrimEnd(end)
    if (videoRef.current) videoRef.current.currentTime = start
  }

  // Keep preview inside the trimmed range while playing.
  useEffect(() => {
    const v = videoRef.current
    if (!v) return undefined
    const onTime = () => {
      if (v.currentTime >= trimEnd - 0.05) {
        v.pause()
        setPlaying(false)
      }
    }
    v.addEventListener('timeupdate', onTime)
    return () => v.removeEventListener('timeupdate', onTime)
  }, [trimEnd])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const timeFromClientX = (clientX) => {
    const track = trackRef.current?.getBoundingClientRect()
    if (!track?.width) return 0
    const ratio = Math.max(0, Math.min(1, (clientX - track.left) / track.width))
    return ratio * fullDuration
  }

  const bindHandleDrag = (side) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    setPlaying(false)
    setScrubbing(side)
    seekPreviewFrame(side, trimStart, trimEnd)

    const onMove = (ev) => {
      const t = timeFromClientX(ev.clientX)
      if (side === 'start') {
        const { start, end } = clampRange(t, trimEnd)
        setTrimStart(start)
        setTrimEnd(end)
        seekPreviewFrame('start', start, end)
      } else {
        const { start, end } = clampRange(trimStart, t)
        setTrimStart(start)
        setTrimEnd(end)
        seekPreviewFrame('end', start, end)
      }
    }
    const onUp = () => {
      setScrubbing(null)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onRangeDrag = (e) => {
    if (e.target.closest('.trim-handle')) return
    e.preventDefault()
    setPlaying(false)
    setScrubbing(null)
    const originX = e.clientX
    const originStart = trimStart
    const originEnd = trimEnd
    const len = originEnd - originStart
    const onMove = (ev) => {
      const track = trackRef.current?.getBoundingClientRect()
      if (!track?.width) return
      const delta = ((ev.clientX - originX) / track.width) * fullDuration
      let start = originStart + delta
      let end = originEnd + delta
      if (start < 0) {
        start = 0
        end = len
      }
      if (end > fullDuration) {
        end = fullDuration
        start = fullDuration - len
      }
      setTrimStart(start)
      setTrimEnd(end)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    setScrubbing(null)
    if (playing) {
      v.pause()
      setPlaying(false)
    } else {
      if (v.currentTime < trimStart || v.currentTime >= trimEnd) v.currentTime = trimStart
      v.play().then(() => setPlaying(true)).catch(() => {})
    }
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await updateVideoTrim(firework.id, {
        trim_start: trimStart,
        trim_end: trimEnd,
      })
      onSaved(result)
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const startPct = fullDuration ? (trimStart / fullDuration) * 100 : 0
  const endPct = fullDuration ? (trimEnd / fullDuration) * 100 : 100
  const trimDuration = Math.max(0, trimEnd - trimStart)

  return (
    <div className="trim-modal-backdrop" onClick={onClose}>
      <div className="trim-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="trim-modal-title">Trim Video</h3>
        <p className="trim-modal-subtitle">{firework.name}</p>

        <div className="trim-preview-wrap">
          <video
            ref={videoRef}
            src={firework.video_url}
            className="trim-preview-video"
            playsInline
            muted
            preload="auto"
            onLoadedMetadata={onVideoMeta}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
          {scrubbing && !playing && (
            <span className="trim-preview-badge">
              {scrubbing === 'start' ? 'Start frame' : 'End frame'}
            </span>
          )}
        </div>

        <div className="trim-controls">
          <button type="button" onClick={togglePlay} disabled={!fullDuration}>
            {playing ? '⏸ Pause' : '▶ Preview trim'}
          </button>
          <span className="trim-duration-label">
            Clip: {fmt(trimStart)} – {fmt(trimEnd)} ({trimDuration.toFixed(1)}s)
          </span>
        </div>

        <div
          ref={trackRef}
          className="trim-track"
          style={{ opacity: fullDuration ? 1 : 0.4 }}
        >
          <div className="trim-filmstrip">
            {frames.map((src, i) => (
              <div
                key={i}
                className="trim-filmstrip-cell"
                style={{ backgroundImage: src ? `url(${src})` : undefined }}
              />
            ))}
          </div>

          <div className="trim-dim" style={{ width: `${startPct}%` }} />
          <div
            className="trim-range"
            style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
            onPointerDown={onRangeDrag}
          >
            <div
              className="trim-handle trim-handle-left"
              onPointerDown={bindHandleDrag('start')}
            />
            <div
              className="trim-handle trim-handle-right"
              onPointerDown={bindHandleDrag('end')}
            />
          </div>
          <div className="trim-dim trim-dim-right" style={{ width: `${100 - endPct}%` }} />
        </div>

        <p className="trim-hint">Drag the handles or slide the selection — like Photos on iOS.</p>

        {error && <p className="trim-error">{error}</p>}

        <div className="trim-actions">
          <button type="button" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="trim-save"
            onClick={save}
            disabled={saving || !fullDuration}
          >
            {saving ? 'Saving…' : 'Save trim'}
          </button>
        </div>
      </div>
    </div>
  )
}
