import { useDraggable } from '@dnd-kit/core'
import { PX_PER_SEC, TYPE_COLORS, TRACK_HEIGHT } from '../constants.js'

// A placed firework. Width encodes duration (duration × PX_PER_SEC); left encodes
// start time. Horizontally draggable to reposition (see App's onDragEnd).
export default function Clip({ clip }) {
  const { firework, startSec } = clip
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `clip-${clip.id}`,
    data: { kind: 'clip', clipId: clip.id, startSec },
  })

  const width = firework.duration_sec * PX_PER_SEC
  const color = TYPE_COLORS[firework.type] ?? '#888'

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        position: 'absolute',
        left: startSec * PX_PER_SEC,
        top: 4,
        height: TRACK_HEIGHT - 8,
        width,
        transform: transform ? `translateX(${transform.x}px)` : undefined,
        background: `${color}33`,
        border: `1px solid ${color}`,
        borderRadius: 5,
        padding: '0 8px',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        cursor: 'grab',
        userSelect: 'none',
        zIndex: isDragging ? 10 : 1,
        boxShadow: isDragging ? '0 4px 12px rgba(0,0,0,0.4)' : 'none',
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
      {firework.name}
      <span style={{ color: 'var(--muted)' }}>{firework.duration_sec}s</span>
    </div>
  )
}
