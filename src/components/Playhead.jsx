import { TRACK_CONTROLS_WIDTH } from '../constants.js'
import { useShowStore } from '../store/useShowStore.js'

// Vertical cursor spanning ruler + waveform + all tracks.
export default function Playhead() {
  const currentTime = useShowStore((s) => s.currentTime)
  const pxPerSec = useShowStore((s) => s.pxPerSec)

  return (
    <div
      style={{
        position: 'absolute',
        left: TRACK_CONTROLS_WIDTH + currentTime * pxPerSec,
        top: 0,
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
