import { useEffect, useRef } from 'react'
import WaveSurfer from 'wavesurfer.js'
import { PX_PER_SEC } from '../constants.js'
import { useShowStore } from '../store/useShowStore.js'

// Owns the single wavesurfer instance (the app's audio engine + clock). Renders at
// the shared scale via minPxPerSec + fillParent:false so its width equals
// audioDuration × PX_PER_SEC and lines up with the ruler and tracks.
export default function WaveformTrack({ wsRef, totalSeconds }) {
  const containerRef = useRef(null)
  const audioUrl = useShowStore((s) => s.audioUrl)
  const setDuration = useShowStore((s) => s.setDuration)
  const setCurrentTime = useShowStore((s) => s.setCurrentTime)
  const setIsPlaying = useShowStore((s) => s.setIsPlaying)

  // Create the wavesurfer instance once.
  useEffect(() => {
    const ws = WaveSurfer.create({
      container: containerRef.current,
      height: 64,
      waveColor: '#5a6473',
      progressColor: '#5a6473', // we draw our own playhead; keep progress neutral
      cursorWidth: 0,
      minPxPerSec: PX_PER_SEC,
      fillParent: false, // render at natural width so the outer container scrolls it
      autoScroll: false,
      hideScrollbar: true,
      normalize: true,
      interact: false, // seeking is handled by the Timeline click handler
    })
    wsRef.current = ws

    ws.on('ready', () => setDuration(ws.getDuration()))
    ws.on('timeupdate', (t) => setCurrentTime(t))
    ws.on('play', () => setIsPlaying(true))
    ws.on('pause', () => setIsPlaying(false))
    ws.on('finish', () => setIsPlaying(false))

    return () => {
      ws.destroy()
      wsRef.current = null
    }
  }, [wsRef, setDuration, setCurrentTime, setIsPlaying])

  // Load audio whenever a new file is chosen.
  useEffect(() => {
    if (audioUrl && wsRef.current) wsRef.current.load(audioUrl)
  }, [audioUrl, wsRef])

  return (
    <div
      style={{
        position: 'relative',
        width: totalSeconds * PX_PER_SEC,
        height: 64,
        background: 'var(--panel-2)',
        borderBottom: '1px solid var(--border)',
      }}
    >
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
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
