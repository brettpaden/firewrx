import { TRACK_HEIGHT } from '../constants.js'
import { useShowStore } from '../store/useShowStore.js'
import Clip from './Clip.jsx'

// One lane per placed clip. Striped background so empty lanes are visible.
export default function Track({ clip, totalSeconds }) {
  const pxPerSec = useShowStore((s) => s.pxPerSec)
  return (
    <div
      style={{
        position: 'relative',
        height: TRACK_HEIGHT,
        width: totalSeconds * pxPerSec,
        borderBottom: '1px solid var(--border)',
        background: clip.trackIndex % 2 ? 'var(--panel)' : 'var(--panel-2)',
      }}
    >
      <Clip clip={clip} />
    </div>
  )
}
