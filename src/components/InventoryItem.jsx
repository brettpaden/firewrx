import { useDraggable } from '@dnd-kit/core'
import { TYPE_COLORS } from '../constants.js'

export default function InventoryItem({ firework }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `inv-${firework.id}`,
    data: { kind: 'inventory', firework },
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 10px',
        marginBottom: 6,
        borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--panel-2)',
        cursor: 'grab',
        opacity: isDragging ? 0.4 : 1,
        userSelect: 'none',
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 2,
          background: TYPE_COLORS[firework.type] ?? '#888',
          flexShrink: 0,
        }}
      />
      <span style={{ flex: 1, fontSize: 13 }}>{firework.name}</span>
      <span style={{ fontSize: 11, color: 'var(--muted)' }}>
        {firework.type} · {firework.duration_sec}s
      </span>
    </div>
  )
}
