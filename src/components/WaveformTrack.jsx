import { useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { wireAudioClock } from '../audioClock.js'
import { useShowStore } from '../store/useShowStore.js'

// Owns the single wavesurfer instance (the app's audio engine). The HTMLMediaElement
// is the source of truth for playback time.
export default function WaveformTrack({ wsRef, laneWidth }) {
  const containerRef = useRef(null)
  const audioUrl = useShowStore((s) => s.audioUrl)
  const pxPerSec = useShowStore((s) => s.pxPerSec)
  const duration = useShowStore((s) => s.duration)
  const setDuration = useShowStore((s) => s.setDuration)
  const setCurrentTime = useShowStore((s) => s.setCurrentTime)
  const setIsPlaying = useShowStore((s) => s.setIsPlaying)

  const pxPerSecRef = useRef(pxPerSec)
  pxPerSecRef.current = pxPerSec

  useEffect(() => {
    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 64,
      waveColor: '#5a6473',
      progressColor: '#5a6473',
      cursorWidth: 0,
      minPxPerSec: pxPerSecRef.current,
      fillParent: false,
      autoScroll: false,
      hideScrollbar: true,
      normalize: true,
      interact: false,
    })
    wsRef.current = ws

    const applyZoom = () => {
      try {
        ws.zoom(pxPerSecRef.current)
      } catch {
        // zoom() throws before decode
      }
    }

    const unwire = wireAudioClock(ws, { setCurrentTime, setIsPlaying })

    ws.on('ready', () => {
      setDuration(ws.getDuration())
      applyZoom()
    })

    return () => {
      unwire()
      ws.destroy()
      wsRef.current = null
    }
  }, [wsRef, setDuration, setCurrentTime, setIsPlaying])

  useEffect(() => {
    if (audioUrl && wsRef.current) wsRef.current.load(audioUrl)
  }, [audioUrl, wsRef])

  useEffect(() => {
    if (wsRef.current) {
      try {
        wsRef.current.zoom(pxPerSec)
      } catch {
        // not decoded yet
      }
    }
  }, [pxPerSec, duration, wsRef])

  const waveWidth = duration > 0 ? duration * pxPerSec : laneWidth

  return (
    <div
      style={{
        position: 'relative',
        width: laneWidth,
        height: 64,
        background: 'var(--panel-2)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div
        ref={containerRef}
        style={{ width: waveWidth, maxWidth: '100%', height: '100%' }}
      />
      {!audioUrl && (
        <span
          style={{
            position: 'absolute',
            left: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 12,
            color: 'var(--muted)',
            pointerEvents: 'none',
          }}
        >
          No audio loaded — use “Upload MP3” above.
        </span>
      )}
    </div>
  )
}
