import { PX_PER_SEC, TRACK_HEIGHT } from '../constants.js'
import Clip from './Clip.jsx'

// One lane per placed clip. Striped background so empty lanes are visible.
export default function Track({ clip, totalSeconds }) {
  return (
    <div
      style={{
        position: 'relative',
        height: TRACK_HEIGHT,
        width: totalSeconds * PX_PER_SEC,
        borderBottom: '1px solid var(--border)',
        background: clip.trackIndex % 2 ? 'var(--panel)' : 'var(--panel-2)',
      }}
    >
      <Clip clip={clip} />
    </div>
  )
}
