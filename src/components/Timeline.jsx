import { useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { PX_PER_SEC, DEFAULT_SECONDS, TRACK_HEIGHT } from '../constants.js'
import { useShowStore } from '../store/useShowStore.js'
import TimeRuler from './TimeRuler.jsx'
import WaveformTrack from './WaveformTrack.jsx'
import Track from './Track.jsx'
import Playhead from './Playhead.jsx'

export default function Timeline({ wsRef }) {
  const contentRef = useRef(null)
  const clips = useShowStore((s) => s.clips)
  const duration = useShowStore((s) => s.duration)
  const setCurrentTime = useShowStore((s) => s.setCurrentTime)

  // Tracks area is the drop target; App reads its rect to convert a drop into a time.
  const { setNodeRef } = useDroppable({ id: 'timeline' })

  const lastClipEnd = clips.reduce(
    (max, c) => Math.max(max, c.startSec + c.firework.duration_sec),
    0,
  )
  const totalSeconds = Math.ceil(Math.max(duration, lastClipEnd, DEFAULT_SECONDS))
  const width = totalSeconds * PX_PER_SEC

  // Click anywhere on the timeline content to position the cursor / seek audio.
  const onSeek = (e) => {
    const rect = contentRef.current.getBoundingClientRect()
    const t = Math.max(0, (e.clientX - rect.left) / PX_PER_SEC)
    if (wsRef.current && duration > 0) {
      wsRef.current.setTime(Math.min(t, duration))
    } else {
      setCurrentTime(t)
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
      <div ref={contentRef} onClick={onSeek} style={{ position: 'relative', width }}>
        <TimeRuler totalSeconds={totalSeconds} />
        <WaveformTrack wsRef={wsRef} totalSeconds={totalSeconds} />

        <div ref={setNodeRef}>
          {clips.length === 0 ? (
            <div
              style={{
                height: TRACK_HEIGHT,
                width,
                display: 'flex',
                alignItems: 'center',
                paddingLeft: 12,
                color: 'var(--muted)',
                fontSize: 12,
                borderBottom: '1px solid var(--border)',
              }}
            >
              Drag fireworks here — each gets its own track.
            </div>
          ) : (
            clips.map((clip) => (
              <Track key={clip.id} clip={clip} totalSeconds={totalSeconds} />
            ))
          )}
        </div>

        <Playhead />
      </div>
    </div>
  )
}
