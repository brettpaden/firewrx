import { useRef } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  DEFAULT_SECONDS,
  TRACK_HEIGHT,
  TRACK_CONTROLS_WIDTH,
  DROP_PAD_TRACKS,
  TIMELINE_HEADER_HEIGHT,
} from '../constants.js'
import { seekTimeline } from '../audioSeek.js'
import { useShowStore } from '../store/useShowStore.js'
import TimeRuler from './TimeRuler.jsx'
import WaveformTrack from './WaveformTrack.jsx'
import Track from './Track.jsx'
import TrackControls from './TrackControls.jsx'
import Playhead from './Playhead.jsx'

const laneStyle = {
  position: 'relative',
  flexShrink: 0,
}

export default function Timeline({ wsRef, onBackgroundClick }) {
  const rootRef = useRef(null)
  const clips = useShowStore((s) => s.clips)
  const duration = useShowStore((s) => s.duration)
  const pxPerSec = useShowStore((s) => s.pxPerSec)

  const { setNodeRef } = useDroppable({ id: 'timeline' })

  const lastClipEnd = clips.reduce(
    (max, c) => Math.max(max, c.startSec + c.firework.duration_sec),
    0,
  )
  const totalSeconds = Math.ceil(Math.max(duration, lastClipEnd, DEFAULT_SECONDS))
  const laneWidth = totalSeconds * pxPerSec
  const rowWidth = TRACK_CONTROLS_WIDTH + laneWidth
  const dropZoneHeight =
    clips.length === 0 ? TRACK_HEIGHT : (clips.length + DROP_PAD_TRACKS) * TRACK_HEIGHT

  const onLaneSeek = (e) => {
    if (e.button !== 0) return
    if (e.target.closest('button, input, select, textarea, [data-no-seek], [data-clip]')) {
      return
    }
    onBackgroundClick?.()
    seekTimeline(wsRef, e.clientX, e.currentTarget)
  }

  return (
    <div ref={rootRef} style={{ flex: 1, overflow: 'auto', background: 'var(--bg)' }}>
      <div style={{ position: 'relative', width: rowWidth, minWidth: '100%' }}>
        <Playhead />

        {/* Ruler + waveform */}
        <div style={{ display: 'flex', width: rowWidth }}>
          <div
            data-no-seek
            style={{
              width: TRACK_CONTROLS_WIDTH,
              flexShrink: 0,
              height: TIMELINE_HEADER_HEIGHT,
              borderRight: '1px solid var(--border)',
              borderBottom: '1px solid var(--border)',
              background: 'var(--panel)',
            }}
          />
          <div
            className="timeline-lane"
            onPointerDown={onLaneSeek}
            style={{ ...laneStyle, width: laneWidth }}
          >
            <TimeRuler totalSeconds={totalSeconds} />
            <WaveformTrack wsRef={wsRef} laneWidth={laneWidth} />
          </div>
        </div>

        {/* Clip tracks — controls + lane share one row so X coordinates always match. */}
        <div ref={setNodeRef}>
          {clips.length === 0 ? (
            <div style={{ display: 'flex', width: rowWidth }}>
              <div
                data-no-seek
                style={{
                  width: TRACK_CONTROLS_WIDTH,
                  flexShrink: 0,
                  height: TRACK_HEIGHT,
                  borderRight: '1px solid var(--border)',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--panel)',
                }}
              />
              <div
                className="timeline-lane"
                onPointerDown={onLaneSeek}
                style={{
                  ...laneStyle,
                  width: laneWidth,
                  height: TRACK_HEIGHT,
                  display: 'flex',
                  alignItems: 'center',
                  paddingLeft: 12,
                  color: 'var(--muted)',
                  fontSize: 12,
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--panel-2)',
                }}
              >
                Drag fireworks here — each gets its own track.
              </div>
            </div>
          ) : (
            clips.map((clip) => (
              <div key={clip.id} style={{ display: 'flex', width: rowWidth }}>
                <div data-no-seek style={{ width: TRACK_CONTROLS_WIDTH, flexShrink: 0 }}>
                  <TrackControls clip={clip} />
                </div>
                <div
                  className="timeline-lane"
                  onPointerDown={onLaneSeek}
                  style={{ ...laneStyle, width: laneWidth }}
                >
                  <Track clip={clip} totalSeconds={totalSeconds} />
                </div>
              </div>
            ))
          )}

          {clips.length > 0 && (
            <div style={{ display: 'flex', width: rowWidth }}>
              <div
                data-no-seek
                style={{
                  width: TRACK_CONTROLS_WIDTH,
                  flexShrink: 0,
                  height: DROP_PAD_TRACKS * TRACK_HEIGHT,
                }}
              />
              <div
                className="timeline-lane"
                onPointerDown={onLaneSeek}
                style={{
                  ...laneStyle,
                  width: laneWidth,
                  minHeight: DROP_PAD_TRACKS * TRACK_HEIGHT,
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
