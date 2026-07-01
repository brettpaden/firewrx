import { TRACK_CONTROLS_WIDTH, TIMELINE_HEADER_HEIGHT } from '../constants.js'
import { useShowStore } from '../store/useShowStore.js'

// Vertical cursor over the clip tracks. Inside the waveform band the native
// wavesurfer cursor is the playhead; this overlay continues that line down through
// the clips. Both derive from the same pxPerSec + origin, so they line up exactly.
export default function Playhead() {
  const currentTime = useShowStore((s) => s.currentTime)
  const pxPerSec = useShowStore((s) => s.pxPerSec)

  return (
    <div
      style={{
        position: 'absolute',
        left: TRACK_CONTROLS_WIDTH + currentTime * pxPerSec,
        top: TIMELINE_HEADER_HEIGHT,
        bottom: 0,
        width: 2,
        marginLeft: -1,
        background: 'var(--accent)',
        pointerEvents: 'none',
        zIndex: 20,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: -4,
          width: 10,
          height: 10,
          background: 'var(--accent)',
          clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
        }}
      />
    </div>
  )
}
