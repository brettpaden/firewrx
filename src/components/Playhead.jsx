import { PX_PER_SEC } from '../constants.js'
import { useShowStore } from '../store/useShowStore.js'

// Vertical cursor spanning ruler + waveform + all tracks. Position is driven by the
// store's currentTime, which wavesurfer updates on every 'timeupdate'.
export default function Playhead() {
  const currentTime = useShowStore((s) => s.currentTime)

  return (
    <div
      style={{
        position: 'absolute',
        left: currentTime * PX_PER_SEC,
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
